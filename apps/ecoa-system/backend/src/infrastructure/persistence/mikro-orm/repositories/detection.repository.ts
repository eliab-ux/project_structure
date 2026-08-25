import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, FilterQuery } from '@mikro-orm/core';
// SQL EntityManager exposes getKnex() (raw parameterized query for the byAccount grouping).
import { EntityManager } from '@mikro-orm/postgresql';
import {
  DetectionListFilters,
  DetectionRepositoryPort,
  DetectionSummaryResult,
} from '../../../../contexts/detection/application/ports/output/detection-repository.port';
import { Detection } from '../../../../contexts/detection/domain/entities/detection.entity';
import { DetectionOrmEntity } from '../entities/detection-orm.entity';
import { DetectionMapper } from '../mappers/detection.mapper';

@Injectable()
export class MikroOrmDetectionRepository implements DetectionRepositoryPort {
  constructor(
    @InjectRepository(DetectionOrmEntity)
    private readonly repository: EntityRepository<DetectionOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: DetectionMapper,
  ) {}

  async save(detection: Detection): Promise<Detection> {
    // Owner-scoped lookup to decide insert vs. update — never touch another tenant's row.
    const existing = await this.repository.findOne({
      ownerId: detection.ownerId,
      id: detection.id.value,
    });
    const orm = this.mapper.toOrm(detection, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findById(ownerId: string, id: string): Promise<Detection | null> {
    const orm = await this.repository.findOne({ ownerId, id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async list(
    ownerId: string,
    filters: DetectionListFilters,
  ): Promise<{ items: Detection[]; total: number }> {
    const where = this.buildWhere(ownerId, filters);
    const [orms, total] = await this.repository.findAndCount(where, {
      orderBy: { detectedAt: 'desc' },
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    });
    return {
      items: orms.map((orm) => this.mapper.toDomain(orm)),
      total,
    };
  }

  async summary(ownerId: string, now: Date): Promise<DetectionSummaryResult> {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // All counts are owner-scoped.
    const [total, last7Days, last30Days] = await Promise.all([
      this.repository.count({ ownerId }),
      this.repository.count({ ownerId, detectedAt: { $gte: sevenDaysAgo } }),
      this.repository.count({ ownerId, detectedAt: { $gte: thirtyDaysAgo } }),
    ]);

    // Top sources via grouped, owner-scoped, parameterized query.
    const knex = this.em.getKnex();
    const rows = await knex('detection')
      .where({ owner_id: ownerId })
      .select('source_username')
      .count<{ source_username: string; count: string }[]>('id as count')
      .groupBy('source_username')
      .orderBy('count', 'desc')
      .limit(10);

    const byAccount = rows.map((row) => ({
      sourceUsername: row.source_username,
      count: Number(row.count),
    }));

    return { total, last7Days, last30Days, byAccount };
  }

  private buildWhere(
    ownerId: string,
    filters: DetectionListFilters,
  ): FilterQuery<DetectionOrmEntity> {
    const where: FilterQuery<DetectionOrmEntity> = { ownerId };

    if (filters.watchlistOnly) {
      where.watchedAccountId = { $ne: null };
    }
    if (filters.seen !== undefined) {
      where.seen = filters.seen;
    }
    if (filters.from || filters.to) {
      where.detectedAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    return where;
  }
}
