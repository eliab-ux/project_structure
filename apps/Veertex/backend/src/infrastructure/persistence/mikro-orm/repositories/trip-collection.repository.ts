import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TripCollectionRepositoryPort } from '../../../../contexts/route/application/ports/output/trip-collection-repository.port';
import {
  CollectionKind,
  TripCollection,
} from '../../../../contexts/route/domain/entities/trip-collection.entity';
import { TripCollectionOrmEntity } from '../entities/trip-collection-orm.entity';

@Injectable()
export class MikroOrmTripCollectionRepository implements TripCollectionRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: TripCollectionOrmEntity): TripCollection {
    return TripCollection.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      tripId: orm.tripId,
      titleId: orm.titleId,
      kind: orm.kind as CollectionKind,
      amountAtBuild: Number(orm.amountAtBuild),
      createdAt: orm.createdAt,
    });
  }

  async listByTrip(tripId: string): Promise<TripCollection[]> {
    const rows = await this.em.find(
      TripCollectionOrmEntity,
      { tripId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async countByTitle(titleId: string): Promise<number> {
    return this.em.count(TripCollectionOrmEntity, { titleId });
  }

  async existsForTripTitle(tripId: string, titleId: string): Promise<boolean> {
    return (await this.em.count(TripCollectionOrmEntity, { tripId, titleId })) > 0;
  }

  async save(collection: TripCollection): Promise<TripCollection> {
    const orm = this.em.create(TripCollectionOrmEntity, {
      id: collection.id,
      accountId: collection.accountId,
      tripId: collection.tripId,
      titleId: collection.titleId,
      kind: collection.kind,
      amountAtBuild: collection.amountAtBuild.toFixed(2),
      createdAt: collection.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
