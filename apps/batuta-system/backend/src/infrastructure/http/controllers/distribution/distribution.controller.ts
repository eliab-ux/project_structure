import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { PlanDistributionUseCase } from '../../../../contexts/distribution/application/use-cases/plan-distribution/plan-distribution.use-case';
import { PlanDistributionCommand } from '../../../../contexts/distribution/application/use-cases/plan-distribution/plan-distribution.command';
import { ConfirmDistributionUseCase } from '../../../../contexts/distribution/application/use-cases/confirm-distribution/confirm-distribution.use-case';
import { ConfirmDistributionCommand } from '../../../../contexts/distribution/application/use-cases/confirm-distribution/confirm-distribution.command';
import { ListDistributionsUseCase } from '../../../../contexts/distribution/application/use-cases/list-distributions/list-distributions.use-case';
import { ListDistributionsQuery } from '../../../../contexts/distribution/application/use-cases/list-distributions/list-distributions.query';
import { GetDistributionUseCase } from '../../../../contexts/distribution/application/use-cases/get-distribution/get-distribution.use-case';
import { GetDistributionQuery } from '../../../../contexts/distribution/application/use-cases/get-distribution/get-distribution.query';
import { PauseDistributionUseCase } from '../../../../contexts/dispatch/application/use-cases/pause-distribution/pause-distribution.use-case';
import { ResumeDistributionUseCase } from '../../../../contexts/dispatch/application/use-cases/resume-distribution/resume-distribution.use-case';
import { CancelDistributionUseCase } from '../../../../contexts/dispatch/application/use-cases/cancel-distribution/cancel-distribution.use-case';
import { DistributionControlCommand } from '../../../../contexts/dispatch/application/use-cases/pause-distribution/pause-distribution.command';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CancelDistributionRequestDto,
  ConfirmDistributionRequestDto,
  DistributionControlRequestDto,
  ListDistributionsQueryDto,
  PlanDistributionRequestDto,
} from './dto/distribution-request.dto';
import {
  DistributionControlResponseDto,
  DistributionPreviewResponseDto,
  DistributionProgressResponseDto,
  DistributionResponseDto,
} from './dto/distribution-response.dto';

/**
 * Distribution planning (FASE 6).
 *
 * The flow is three calls and the middle one is the point:
 *
 *  1. `POST /distributions/preview` — computes everything, persists nothing;
 *  2. `POST /distributions` — persists the plan as `dispatches` rows in DRAFT, and returns the same
 *     preview. Still nothing is queued and nothing will be sent;
 *  3. `POST /distributions/:id/confirm` — the only call that hands work to the queue.
 *
 * Splitting 2 and 3 is what makes "prévia obrigatória antes de confirmar" (§9.3) structural rather
 * than a UI convention: confirmation acts on a plan that already exists as data, so the operator
 * cannot confirm something they were never shown.
 */
@Controller('distributions')
@UseGuards(JwtAuthGuard)
export class DistributionController {
  constructor(
    private readonly planDistribution: PlanDistributionUseCase,
    private readonly confirmDistribution: ConfirmDistributionUseCase,
    private readonly listDistributions: ListDistributionsUseCase,
    private readonly getDistribution: GetDistributionUseCase,
    private readonly pauseDistribution: PauseDistributionUseCase,
    private readonly resumeDistribution: ResumeDistributionUseCase,
    private readonly cancelDistribution: CancelDistributionUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: ListDistributionsQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PaginatedResult<DistributionResponseDto>> {
    const page = await this.listDistributions.execute(
      new ListDistributionsQuery(
        user.accountId,
        query.page,
        query.limit,
        query.status,
        query.contentId,
      ),
    );
    return {
      data: page.data.map((distribution) => DistributionResponseDto.from(distribution)),
      meta: page.meta,
    };
  }

  /** Dry run: the numbers, the blocked list, the samples — and not a single row written. */
  @Post('preview')
  @HttpCode(200)
  async preview(
    @Body() dto: PlanDistributionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionPreviewResponseDto> {
    const preview = await this.planDistribution.execute(
      new PlanDistributionCommand(
        user.accountId,
        user.sub,
        dto.contentId,
        new Date(dto.windowStart),
        new Date(dto.windowEnd),
        dto.tags ?? [],
        dto.variantMappings ?? [],
        true,
        ip,
      ),
    );
    return DistributionPreviewResponseDto.from(preview);
  }

  /** Persists the plan. Returns the preview of what was persisted, for the confirmation screen. */
  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: PlanDistributionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionPreviewResponseDto> {
    const created = await this.planDistribution.execute(
      new PlanDistributionCommand(
        user.accountId,
        user.sub,
        dto.contentId,
        new Date(dto.windowStart),
        new Date(dto.windowEnd),
        dto.tags ?? [],
        dto.variantMappings ?? [],
        false,
        ip,
      ),
    );
    return DistributionPreviewResponseDto.from(created);
  }

  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<DistributionProgressResponseDto> {
    const progress = await this.getDistribution.execute(
      new GetDistributionQuery(user.accountId, id),
    );
    return DistributionProgressResponseDto.from(progress);
  }

  /** The one call that hands work to the queue. Re-checks the approval before doing it. */
  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDistributionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionResponseDto> {
    const confirmed = await this.confirmDistribution.execute(
      new ConfirmDistributionCommand(
        user.accountId,
        user.sub,
        id,
        dto.expectedContentHash ?? null,
        ip,
      ),
    );
    return DistributionResponseDto.from(confirmed);
  }

  /**
   * The three running controls of §10, FASE 7 item 8.
   *
   * Deliberately POST and not PATCH on a status field: "pause" is an operation with side effects on a
   * queue, not an attribute the client sets. A PATCH that accepted `{ "status": "PAUSED" }` would also
   * invite `{ "status": "COMPLETED" }`, which no client may ever decide.
   *
   * Any authenticated user of the account may stop a running campaign. That asymmetry with settings is
   * on purpose: stopping is the safe direction, and needing an admin to be reachable before a bad send
   * can be halted would be the wrong trade.
   */
  @Post(':id/pause')
  @HttpCode(200)
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: DistributionControlRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionControlResponseDto> {
    const result = await this.pauseDistribution.execute(
      new DistributionControlCommand(user.accountId, user.sub, id, null, ip),
    );
    return DistributionControlResponseDto.from(result);
  }

  @Post(':id/resume')
  @HttpCode(200)
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: DistributionControlRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionControlResponseDto> {
    const result = await this.resumeDistribution.execute(
      new DistributionControlCommand(user.accountId, user.sub, id, null, ip),
    );
    return DistributionControlResponseDto.from(result);
  }

  /** Irreversible: cancels what has not gone out, preserves what has. */
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDistributionRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<DistributionControlResponseDto> {
    const result = await this.cancelDistribution.execute(
      new DistributionControlCommand(user.accountId, user.sub, id, dto.reason ?? null, ip),
    );
    return DistributionControlResponseDto.from(result);
  }
}
