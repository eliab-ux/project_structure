import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ContentRepositoryPort } from '../../../../contexts/content/application/ports/output/content-repository.port';
import { OwnMedia } from '../../../../contexts/content/domain/entities/own-media.entity';
import { OwnMediaOrmEntity } from '../entities/own-media-orm.entity';
import { OwnMediaMapper } from '../mappers/own-media.mapper';

@Injectable()
export class MikroOrmContentRepository implements ContentRepositoryPort {
  constructor(
    @InjectRepository(OwnMediaOrmEntity)
    private readonly repository: EntityRepository<OwnMediaOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: OwnMediaMapper,
  ) {}

  async save(media: OwnMedia): Promise<OwnMedia> {
    // Owner-scoped lookup to decide insert vs. update — never touch another tenant's row.
    const existing = await this.repository.findOne({
      ownerId: media.ownerId,
      id: media.id.value,
    });
    const orm = this.mapper.toOrm(media, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findByOwnerAndIgMediaId(ownerId: string, igMediaId: string): Promise<OwnMedia | null> {
    const orm = await this.repository.findOne({ ownerId, igMediaId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findById(ownerId: string, id: string): Promise<OwnMedia | null> {
    const orm = await this.repository.findOne({ ownerId, id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listByOwner(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<{ items: OwnMedia[]; total: number }> {
    const [orms, total] = await this.repository.findAndCount(
      { ownerId },
      {
        orderBy: { publishedAt: 'desc' },
        limit,
        offset: (page - 1) * limit,
      },
    );
    return {
      items: orms.map((orm) => this.mapper.toDomain(orm)),
      total,
    };
  }

  async findRecentByOwner(ownerId: string, limit: number): Promise<OwnMedia[]> {
    const orms = await this.repository.find(
      { ownerId },
      { orderBy: { publishedAt: 'desc' }, limit },
    );
    return orms.map((orm) => this.mapper.toDomain(orm));
  }
}
