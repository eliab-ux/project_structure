import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GetVideoByDayUseCase } from '../../../../contexts/catalog/application/use-cases/get-video-by-day/get-video-by-day.use-case';
import { ListCatalogUseCase } from '../../../../contexts/catalog/application/use-cases/list-catalog/list-catalog.use-case';
import { ResolveVideoForDateUseCase } from '../../../../contexts/catalog/application/use-cases/resolve-video-for-date/resolve-video-for-date.use-case';
import { SyncCatalogUseCase } from '../../../../contexts/catalog/application/use-cases/sync-catalog/sync-catalog.use-case';
import { localDateInTimeZone } from '../../../../shared/plan/local-date';
import { PlanSettings } from '../../../../shared/plan/plan-settings';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { DayNumberParamDto, ListCatalogQueryDto, TodayQueryDto } from './dto/catalog-request.dto';
import {
  CatalogListResponseDto,
  CatalogSyncResponseDto,
  TodayResponseDto,
  VideoResponseDto,
} from './dto/catalog-response.dto';

/**
 * O catálogo é global (o plano de leitura é o mesmo para todos), mas os endpoints exigem
 * autenticação: quem não tem conta não tem por que consultar a API.
 */
@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly listCatalogUseCase: ListCatalogUseCase,
    private readonly getVideoByDayUseCase: GetVideoByDayUseCase,
    private readonly resolveVideoForDateUseCase: ResolveVideoForDateUseCase,
    private readonly planSettings: PlanSettings,
  ) {}

  /** Catálogo inteiro com a data de cada dia — é a tela de conferência do alinhamento. */
  @Get('days')
  async listDays(@Query() query: ListCatalogQueryDto): Promise<CatalogListResponseDto> {
    const result = await this.listCatalogUseCase.execute({
      planStartDate: query.planStartDate ?? this.planSettings.planStartDate,
      dayOffset: query.dayOffset ?? this.planSettings.dayOffset,
    });
    return CatalogListResponseDto.fromResult(result);
  }

  @Get('today')
  async today(@Query() query: TodayQueryDto): Promise<TodayResponseDto> {
    const localDate = query.date ?? localDateInTimeZone(new Date(), this.planSettings.timezone);
    const resolved = await this.resolveVideoForDateUseCase.execute({
      localDate,
      planStartDate: query.planStartDate ?? this.planSettings.planStartDate,
      dayOffset: query.dayOffset ?? this.planSettings.dayOffset,
    });
    return TodayResponseDto.fromDto(resolved);
  }

  @Get('day/:dayNumber')
  async byDay(@Param() params: DayNumberParamDto): Promise<VideoResponseDto> {
    const video = await this.getVideoByDayUseCase.execute({ dayNumber: params.dayNumber });
    return VideoResponseDto.fromDto(video);
  }
}

@Controller('admin/catalog')
@UseGuards(AdminGuard)
export class AdminCatalogController {
  constructor(private readonly syncCatalogUseCase: SyncCatalogUseCase) {}

  /** Sync manual. A automática (BullMQ, 03:00) entra na Fase 6. */
  @Post('sync')
  async sync(): Promise<CatalogSyncResponseDto> {
    return CatalogSyncResponseDto.fromDto(await this.syncCatalogUseCase.execute());
  }
}
