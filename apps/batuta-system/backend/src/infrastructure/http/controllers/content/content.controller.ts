import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { PaginatedResult } from '@gitspread/shared-kernel';
import { CreateContentUseCase } from '../../../../contexts/content/application/use-cases/create-content/create-content.use-case';
import { CreateContentCommand } from '../../../../contexts/content/application/use-cases/create-content/create-content.command';
import { DuplicateContentUseCase } from '../../../../contexts/content/application/use-cases/duplicate-content/duplicate-content.use-case';
import { DuplicateContentCommand } from '../../../../contexts/content/application/use-cases/duplicate-content/duplicate-content.command';
import { UpdateContentUseCase } from '../../../../contexts/content/application/use-cases/update-content/update-content.use-case';
import { UpdateContentCommand } from '../../../../contexts/content/application/use-cases/update-content/update-content.command';
import { ListContentsUseCase } from '../../../../contexts/content/application/use-cases/list-contents/list-contents.use-case';
import { ListContentsQuery } from '../../../../contexts/content/application/use-cases/list-contents/list-contents.query';
import { GetContentUseCase } from '../../../../contexts/content/application/use-cases/get-content/get-content.use-case';
import { GetContentQuery } from '../../../../contexts/content/application/use-cases/get-content/get-content.query';
import { AddVariantUseCase } from '../../../../contexts/content/application/use-cases/add-variant/add-variant.use-case';
import { AddVariantCommand } from '../../../../contexts/content/application/use-cases/add-variant/add-variant.command';
import { UpdateVariantUseCase } from '../../../../contexts/content/application/use-cases/update-variant/update-variant.use-case';
import { UpdateVariantCommand } from '../../../../contexts/content/application/use-cases/update-variant/update-variant.command';
import { RemoveVariantUseCase } from '../../../../contexts/content/application/use-cases/remove-variant/remove-variant.use-case';
import { RemoveVariantCommand } from '../../../../contexts/content/application/use-cases/remove-variant/remove-variant.command';
import { AttachMediaUseCase } from '../../../../contexts/content/application/use-cases/attach-media/attach-media.use-case';
import { AttachMediaCommand } from '../../../../contexts/content/application/use-cases/attach-media/attach-media.command';
import { RemoveMediaUseCase } from '../../../../contexts/content/application/use-cases/remove-media/remove-media.use-case';
import { RemoveMediaCommand } from '../../../../contexts/content/application/use-cases/remove-media/remove-media.command';
import { ArchiveContentUseCase } from '../../../../contexts/content/application/use-cases/archive-content/archive-content.use-case';
import { ArchiveContentCommand } from '../../../../contexts/content/application/use-cases/archive-content/archive-content.command';
import { PreviewContentUseCase } from '../../../../contexts/content/application/use-cases/preview-content/preview-content.use-case';
import { PreviewContentQuery } from '../../../../contexts/content/application/use-cases/preview-content/preview-content.query';
import {
  GetMediaContentQuery,
  GetMediaContentUseCase,
} from '../../../../contexts/content/application/use-cases/get-media-content/get-media-content.use-case';
import {
  ReopenContentCommand,
  ReopenContentUseCase,
} from '../../../../contexts/content/application/use-cases/reopen-content/reopen-content.use-case';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { ClientIp, CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  AddVariantRequestDto,
  ArchiveContentRequestDto,
  AttachMediaRequestDto,
  CreateContentRequestDto,
  ListContentsQueryDto,
  PreviewContentQueryDto,
  UpdateContentRequestDto,
  UpdateVariantRequestDto,
} from './dto/content-request.dto';
import { ContentPreviewResponseDto, ContentResponseDto } from './dto/content-response.dto';

/**
 * Content authoring (FASE 4).
 *
 * Every route is available to any authenticated user of the account: writing and reviewing content is
 * the operator's daily job, and the control that matters is not who may type — it is the approval flow
 * of FASE 5, plus the fact that only APPROVED content can ever be dispatched (§1.4).
 *
 * Note what is NOT here: no endpoint sets `status` to APPROVED (that is FASE 5, through a magic link),
 * no endpoint edits `classification` after creation, and there is no DELETE for a content — only
 * archiving, because a distributed content is referenced by the audit export (§11 item 2).
 */
@Controller('contents')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(
    private readonly createContent: CreateContentUseCase,
    private readonly duplicateContent: DuplicateContentUseCase,
    private readonly updateContent: UpdateContentUseCase,
    private readonly listContents: ListContentsUseCase,
    private readonly getContent: GetContentUseCase,
    private readonly addVariant: AddVariantUseCase,
    private readonly updateVariant: UpdateVariantUseCase,
    private readonly removeVariant: RemoveVariantUseCase,
    private readonly attachMedia: AttachMediaUseCase,
    private readonly removeMedia: RemoveMediaUseCase,
    private readonly archiveContent: ArchiveContentUseCase,
    private readonly previewContent: PreviewContentUseCase,
    private readonly getMediaContent: GetMediaContentUseCase,
    private readonly reopenContent: ReopenContentUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: ListContentsQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PaginatedResult<ContentResponseDto>> {
    const page = await this.listContents.execute(
      new ListContentsQuery(
        user.accountId,
        query.page,
        query.limit,
        query.status,
        query.classification,
        query.search,
      ),
    );
    return { data: page.data.map((content) => ContentResponseDto.from(content)), meta: page.meta };
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateContentRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.createContent.execute(
      new CreateContentCommand(
        user.accountId,
        user.sub,
        dto.title,
        dto.classification,
        dto.origin,
        dto.bodyBase,
        dto.sourceUrl ?? null,
        dto.includeSourceUrl ?? false,
        ip,
      ),
    );
    return ContentResponseDto.from(content);
  }

  /**
   * Copies an existing content as a fresh DRAFT — the common case of reusing a message that worked.
   *
   * 201 with the NEW content: the client navigates to it so a human validates and saves before it can
   * go anywhere. The copy never inherits APPROVED (see the use case), and media is not copied.
   */
  @Post(':id/duplicate')
  @HttpCode(201)
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.duplicateContent.execute(
      new DuplicateContentCommand(user.accountId, user.sub, id, ip),
    );
    return ContentResponseDto.from(content);
  }

  /**
   * Returns a REJECTED content to DRAFT without changing a word.
   *
   * Editing it already does that — this is for the author who disagrees with the rejection and
   * resubmits the same text after talking to the approver. A cosmetic edit to unlock resubmission
   * would change the content_hash, which is supposed to mean "these exact words".
   */
  @Post(':id/reopen')
  @HttpCode(200)
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.reopenContent.execute(
      new ReopenContentCommand(user.accountId, user.sub, id, ip),
    );
    return ContentResponseDto.from(content);
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ContentResponseDto> {
    const content = await this.getContent.execute(new GetContentQuery(user.accountId, id));
    return ContentResponseDto.from(content);
  }

  /**
   * Editing an APPROVED or PENDING_APPROVAL content invalidates the approval and sends it back to
   * DRAFT (§8.5). The response carries the new `status`, so the UI can say so immediately.
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.updateContent.execute(
      new UpdateContentCommand(
        user.accountId,
        user.sub,
        id,
        dto.title,
        dto.bodyBase,
        dto.sourceUrl,
        dto.includeSourceUrl,
        ip,
      ),
    );
    return ContentResponseDto.from(content);
  }

  /** The §7.4 preview: real contacts, at least one demonstrating the fallback. */
  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PreviewContentQueryDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<ContentPreviewResponseDto> {
    const preview = await this.previewContent.execute(
      new PreviewContentQuery(user.accountId, id, query.tags),
    );
    return ContentPreviewResponseDto.from(preview);
  }

  @Post(':id/variants')
  @HttpCode(201)
  async createVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVariantRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.addVariant.execute(
      new AddVariantCommand(user.accountId, user.sub, id, dto.label, dto.body, ip),
    );
    return ContentResponseDto.from(content);
  }

  @Patch(':id/variants/:variantId')
  async editVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.updateVariant.execute(
      new UpdateVariantCommand(
        user.accountId,
        user.sub,
        id,
        variantId,
        dto.body,
        dto.markReviewed,
        ip,
      ),
    );
    return ContentResponseDto.from(content);
  }

  @Delete(':id/variants/:variantId')
  async deleteVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.removeVariant.execute(
      new RemoveVariantCommand(user.accountId, user.sub, id, variantId, ip),
    );
    return ContentResponseDto.from(content);
  }

  /** Base64 in JSON — never multipart (Fastify, CLAUDE.md). */
  @Post(':id/media')
  @HttpCode(201)
  async uploadMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachMediaRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.attachMedia.execute(
      new AttachMediaCommand(
        user.accountId,
        user.sub,
        id,
        dto.variantId ?? null,
        dto.fileName,
        dto.mimeType,
        dto.fileBase64,
        ip,
      ),
    );
    return ContentResponseDto.from(content);
  }

  /**
   * The bytes of one media asset, for the app's own screens.
   *
   * Exists for the same reason as the approval-page route: a presigned storage URL is signed against
   * the storage's internal endpoint, which no browser resolves. The client fetches this with its JWT
   * and renders the blob.
   */
  @Get(':id/media/:mediaId/content')
  async mediaContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const asset = await this.getMediaContent.execute(
      new GetMediaContentQuery(user.accountId, id, mediaId),
    );

    await reply
      .header('Content-Type', asset.mimeType)
      // Sanitised: the name came from an upload, and a quote or newline in a header is injection.
      .header(
        'Content-Disposition',
        `inline; filename="${asset.originalName.replace(/[^\w.\-() ]/g, '_')}"`,
      )
      .header('Cache-Control', 'private, max-age=300')
      .send(asset.body);
  }

  @Delete(':id/media/:mediaId')
  async deleteMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.removeMedia.execute(
      new RemoveMediaCommand(user.accountId, user.sub, id, mediaId, ip),
    );
    return ContentResponseDto.from(content);
  }

  /** Read-only from here on. There is no delete: a distributed content is audit evidence. */
  @Post(':id/archive')
  @HttpCode(200)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: ArchiveContentRequestDto,
    @CurrentUser() user: AuthTokenPayload,
    @ClientIp() ip: string | null,
  ): Promise<ContentResponseDto> {
    const content = await this.archiveContent.execute(
      new ArchiveContentCommand(user.accountId, user.sub, id, ip),
    );
    return ContentResponseDto.from(content);
  }
}
