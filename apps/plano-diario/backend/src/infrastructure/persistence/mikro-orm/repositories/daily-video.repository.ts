import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
// EntityManager do driver PostgreSQL: é ele que expõe getKnex() para a agregação em SQL.
import { EntityManager } from '@mikro-orm/postgresql';
import {
  CatalogRange,
  DailyVideoRepositoryPort,
} from '../../../../contexts/catalog/application/ports/output/daily-video-repository.port';
import { DailyVideo } from '../../../../contexts/catalog/domain/entities/daily-video.entity';
import { DailyVideoOrmEntity } from '../entities/daily-video-orm.entity';
import { DailyVideoMapper } from '../mappers/daily-video.mapper';

@Injectable()
export class MikroOrmDailyVideoRepository implements DailyVideoRepositoryPort {
  constructor(
    @InjectRepository(DailyVideoOrmEntity)
    private readonly repository: EntityRepository<DailyVideoOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: DailyVideoMapper,
  ) {}

  async findByDayNumber(dayNumber: number): Promise<DailyVideo | null> {
    const orm = await this.repository.findOne({ dayNumber });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAll(): Promise<DailyVideo[]> {
    const rows = await this.repository.findAll({ orderBy: { dayNumber: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async saveAll(videos: DailyVideo[]): Promise<void> {
    if (videos.length === 0) {
      return;
    }
    // Carrega os existentes de uma vez para atualizar as instâncias gerenciadas em vez de
    // criar duplicatas (o EntityManager reclamaria de identidade duplicada na mesma UoW).
    const dayNumbers = videos.map((video) => video.dayNumber);
    const existing = new Map(
      (await this.repository.find({ dayNumber: { $in: dayNumbers } })).map((orm) => [
        orm.dayNumber,
        orm,
      ]),
    );

    for (const video of videos) {
      const orm = this.mapper.toOrm(video, existing.get(video.dayNumber));
      this.em.persist(orm);
    }
    await this.em.flush();
  }

  async range(): Promise<CatalogRange> {
    const [row] = await this.em
      .getKnex()
      .from('daily_videos')
      .select(
        this.em
          .getKnex()
          .raw(
            'count(*)::int as total, min(day_number)::int as first_day, max(day_number)::int as last_day, max(synced_at) as last_synced_at',
          ),
      );

    return {
      total: row?.total ?? 0,
      firstDay: row?.first_day ?? null,
      lastDay: row?.last_day ?? null,
      lastSyncedAt: row?.last_synced_at ? new Date(row.last_synced_at) : null,
    };
  }
}
