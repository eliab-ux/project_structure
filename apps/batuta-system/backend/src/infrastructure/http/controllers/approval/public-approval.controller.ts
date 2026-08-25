import { Body, Controller, Get, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { GetApprovalPageUseCase } from '../../../../contexts/approval/application/use-cases/get-approval-page/get-approval-page.use-case';
import { GetApprovalPageQuery } from '../../../../contexts/approval/application/use-cases/get-approval-page/get-approval-page.query';
import { GetApprovalMediaUseCase } from '../../../../contexts/approval/application/use-cases/get-approval-media/get-approval-media.use-case';
import { GetApprovalMediaQuery } from '../../../../contexts/approval/application/use-cases/get-approval-media/get-approval-media.query';
import { DecideApprovalUseCase } from '../../../../contexts/approval/application/use-cases/decide-approval/decide-approval.use-case';
import { DecideApprovalCommand } from '../../../../contexts/approval/application/use-cases/decide-approval/decide-approval.command';
import { ClientIp, ClientUserAgent } from '../../../security/decorators/current-user.decorator';
import { ApprovalRateLimitGuard } from '../../guards/approval-rate-limit.guard';
import {
  ApprovalMediaParamDto,
  ApprovalTokenParamDto,
  DecideApprovalRequestDto,
} from './dto/approval-request.dto';
import { ApprovalDecisionResponseDto, ApprovalPageResponseDto } from './dto/approval-response.dto';

/**
 * The magic-link route (§8 item 4).
 *
 * **PUBLIC ON PURPOSE — no JwtAuthGuard, and here is the documented reason (§8 item 4 requires it):**
 * the person deciding is an approver, and §8 item 2 says an approver "não precisa ter conta de usuário".
 * A lawyer or a chief of staff gets a link on their phone and taps it. Requiring a login would either
 * force accounts on people who will never use the product, or push the approval back into WhatsApp text
 * — which is the weakest possible evidence, the exact thing this design exists to avoid.
 *
 * What stands in for authentication, in layers:
 *  1. **The token** — 256 bits of `randomBytes`, so it cannot be guessed;
 *  2. **stored as SHA-256** — a database dump does not yield usable links;
 *  3. **single use** — a decided request refuses a second decision;
 *  4. **TTL** (`APPROVAL_TOKEN_TTL_HOURS`, default 72h);
 *  5. **bound to `content_hash`** — the link dies the moment the content is edited (§8.5);
 *  6. **rate limit per IP and per token** — `ApprovalRateLimitGuard`;
 *  7. **tenant scope derived from the token**, never from the caller: the use case does one unscoped
 *     read to resolve the request, then runs everything else inside that request's account.
 *
 * Note what these routes do NOT expose: no account name, no audience, no other content, no user, no
 * list of approvers. A valid token buys exactly one message and nothing around it. An invalid one buys a
 * 400 with a generic message, which is deliberate — a 404-vs-403 distinction here would confirm which
 * tokens exist.
 */
@Controller('public/approvals')
@UseGuards(ApprovalRateLimitGuard)
export class PublicApprovalController {
  constructor(
    private readonly getPage: GetApprovalPageUseCase,
    private readonly getMedia: GetApprovalMediaUseCase,
    private readonly decide: DecideApprovalUseCase,
  ) {}

  /**
   * Read-only and idempotent: opening the link twice is normal — people forward it to a bigger screen,
   * and mail clients prefetch URLs. Only POST consumes the token.
   */
  @Get(':token')
  async page(@Param() params: ApprovalTokenParamDto): Promise<ApprovalPageResponseDto> {
    const dto = await this.getPage.execute(new GetApprovalPageQuery(params.token));
    return ApprovalPageResponseDto.from(dto);
  }

  /**
   * One media file of the content under approval.
   *
   * PUBLIC for the same reason as the page, and authorised by the same token. It exists because a
   * presigned storage URL is signed against the storage's internal endpoint, which no browser can
   * resolve — the approver saw `ERR_NAME_NOT_RESOLVED` instead of the image they were approving.
   *
   * `inline` so the image renders in the page rather than downloading. The filename is sanitised
   * because it came from an upload: a quote or a newline in a header value is header injection.
   */
  @Get(':token/media/:mediaId')
  async media(
    // DTO com os DOIS params: `@Param()` sem chave valida o objeto inteiro, e o ValidationPipe global
    // roda com `forbidNonWhitelisted` — reusar o DTO de token recusava o `mediaId`.
    @Param() params: ApprovalMediaParamDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const asset = await this.getMedia.execute(
      new GetApprovalMediaQuery(params.token, params.mediaId),
    );

    await reply
      .header('Content-Type', asset.mimeType)
      .header(
        'Content-Disposition',
        `inline; filename="${asset.originalName.replace(/[^\w.\-() ]/g, '_')}"`,
      )
      // `private`: the response is authorised by a token in the URL, so no shared cache may keep it.
      // Five minutes is enough for the page to render and for a reload not to re-fetch.
      .header('Cache-Control', 'private, max-age=300')
      .send(asset.body);
  }

  /** The decision itself. IP and user-agent are recorded here — that is what makes it defensible. */
  @Post(':token')
  @HttpCode(200)
  async submitDecision(
    @Param() params: ApprovalTokenParamDto,
    @Body() dto: DecideApprovalRequestDto,
    @ClientIp() ip: string | null,
    @ClientUserAgent() userAgent: string | null,
  ): Promise<ApprovalDecisionResponseDto> {
    const result = await this.decide.execute(
      new DecideApprovalCommand(params.token, dto.decision, dto.comment ?? null, ip, userAgent),
    );
    return ApprovalDecisionResponseDto.from(result);
  }
}
