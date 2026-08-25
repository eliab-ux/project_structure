import { Controller, Get, HttpCode, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ListDetectionsUseCase } from '../../../../contexts/detection/application/use-cases/list-detections/list-detections.use-case';
import { ListDetectionsQuery } from '../../../../contexts/detection/application/use-cases/list-detections/list-detections.query';
import { GetDetectionsSummaryUseCase } from '../../../../contexts/detection/application/use-cases/get-detections-summary/get-detections-summary.use-case';
import { GetDetectionsSummaryQuery } from '../../../../contexts/detection/application/use-cases/get-detections-summary/get-detections-summary.query';
import { MarkDetectionSeenUseCase } from '../../../../contexts/detection/application/use-cases/mark-detection-seen/mark-detection-seen.use-case';
import { MarkDetectionSeenCommand } from '../../../../contexts/detection/application/use-cases/mark-detection-seen/mark-detection-seen.command';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { resolveOwnerId } from '../../../../shared/tenant/tenant';
import { ListDetectionsQueryDto } from './dto/detection-request.dto';
import { DetectionResponseDto, DetectionSummaryResponseDto } from './dto/detection-response.dto';

@Controller('detections')
@UseGuards(JwtAuthGuard)
export class DetectionController {
  constructor(
    private readonly listDetectionsUseCase: ListDetectionsUseCase,
    private readonly getDetectionsSummaryUseCase: GetDetectionsSummaryUseCase,
    private readonly markDetectionSeenUseCase: MarkDetectionSeenUseCase,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthTokenPayload,
    @Query() query: ListDetectionsQueryDto,
  ): Promise<{ items: DetectionResponseDto[]; total: number; page: number; limit: number }> {
    const ownerId = resolveOwnerId(user);
    const result = await this.listDetectionsUseCase.execute(
      new ListDetectionsQuery(
        ownerId,
        query.page,
        query.limit,
        query.watchlistOnly,
        query.from ? new Date(query.from) : undefined,
        query.to ? new Date(query.to) : undefined,
        query.seen,
      ),
    );
    return {
      items: result.items.map((detection) => DetectionResponseDto.fromDto(detection)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  // Declared BEFORE the `:id` routes so 'summary' isn't captured as an id.
  @Get('summary')
  async summary(@CurrentUser() user: AuthTokenPayload): Promise<DetectionSummaryResponseDto> {
    const ownerId = resolveOwnerId(user);
    const summary = await this.getDetectionsSummaryUseCase.execute(
      new GetDetectionsSummaryQuery(ownerId),
    );
    return DetectionSummaryResponseDto.fromDto(summary);
  }

  @Patch(':id/seen')
  @HttpCode(200)
  async markSeen(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
  ): Promise<DetectionResponseDto> {
    const ownerId = resolveOwnerId(user);
    const detection = await this.markDetectionSeenUseCase.execute(
      new MarkDetectionSeenCommand(ownerId, id),
    );
    return DetectionResponseDto.fromDto(detection);
  }
}
