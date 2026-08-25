import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InsightRepositoryPort } from '../../../../contexts/insight/application/ports/output/insight-repository.port';
import { MediaInsightSnapshot } from '../../../../contexts/insight/domain/entities/media-insight-snapshot.entity';
import { MediaInsightSnapshotOrmEntity } from '../entities/media-insight-snapshot-orm.entity';
import { MediaInsightSnapshotMapper } from '../mappers/media-insight-snapshot.mapper';

@Injectable()
export class MikroOrmInsightRepository implements InsightRepositoryPort {
  constructor(
    @InjectRepository(MediaInsightSnapshotOrmEntity)
    private readonly repository: EntityRepository<MediaInsightSnapshotOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: MediaInsightSnapshotMapper,
  ) {}

  async save(snapshot: MediaInsightSnapshot): Promise<MediaInsightSnapshot> {
    const existing = await this.repository.findOne({ id: snapshot.id.value });
    const orm = this.mapper.toOrm(snapshot, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findSeriesByMedia(ownerId: string, ownMediaId: string): Promise<MediaInsightSnapshot[]> {
    const rows = await this.repository.find(
      { ownerId, ownMediaId },
      { orderBy: { capturedAt: 'asc' } },
    );
    return rows.map((orm) => this.mapper.toDomain(orm));
  }
}
