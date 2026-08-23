import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ListTripsFilter,
  TripRepositoryPort,
} from '../../../../contexts/route/application/ports/output/trip-repository.port';
import { Trip } from '../../../../contexts/route/domain/entities/trip.entity';
import { TripOrmEntity } from '../entities/trip-orm.entity';

@Injectable()
export class MikroOrmTripRepository implements TripRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: TripOrmEntity): Trip {
    return Trip.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      routeId: orm.routeId,
      salesRepId: orm.salesRepId,
      helperUserId: orm.helperUserId,
      status: orm.status,
      departureAt: orm.departureAt,
      returnAt: orm.returnAt,
      initialCash: orm.initialCash,
      returnCash: orm.returnCash,
      initialKm: orm.initialKm,
      finalKm: orm.finalKm,
      loadLocationId: orm.loadLocationId,
      closure:
        orm.closureManagerUserId === null &&
        orm.closureManagerPercent === null &&
        orm.closureHelperAmount === null &&
        orm.closureCommissionPercent === null &&
        orm.closureRepCommission === null
          ? null
          : {
              managerUserId: orm.closureManagerUserId,
              managerPercent:
                orm.closureManagerPercent === null ? null : Number(orm.closureManagerPercent),
              helperAmount:
                orm.closureHelperAmount === null ? null : Number(orm.closureHelperAmount),
              commissionPercent:
                orm.closureCommissionPercent === null ? null : Number(orm.closureCommissionPercent),
              repCommission:
                orm.closureRepCommission === null ? null : Number(orm.closureRepCommission),
            },
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<Trip | null> {
    const orm = await this.em.findOne(TripOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async list(filter: ListTripsFilter): Promise<Trip[]> {
    const rows = await this.em.find(
      TripOrmEntity,
      {
        ...(filter.routeId ? { routeId: filter.routeId } : {}),
        ...(filter.salesRepId ? { salesRepId: filter.salesRepId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      { orderBy: { createdAt: 'DESC' }, limit: 200 },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(trip: Trip): Promise<Trip> {
    const existing = await this.em.findOne(TripOrmEntity, { id: trip.id });
    if (existing) {
      existing.helperUserId = trip.helperUserId;
      existing.status = trip.status;
      existing.departureAt = trip.departureAt;
      existing.returnAt = trip.returnAt;
      existing.initialCash = trip.initialCash.toFixed(2);
      existing.returnCash = trip.returnCash === null ? null : trip.returnCash.toFixed(2);
      existing.initialKm = trip.initialKm === null ? null : trip.initialKm.toFixed(1);
      existing.finalKm = trip.finalKm === null ? null : trip.finalKm.toFixed(1);
      existing.loadLocationId = trip.loadLocationId;
      existing.closureManagerUserId = trip.closure?.managerUserId ?? null;
      existing.closureManagerPercent =
        trip.closure?.managerPercent == null ? null : trip.closure.managerPercent.toFixed(2);
      existing.closureHelperAmount =
        trip.closure?.helperAmount == null ? null : trip.closure.helperAmount.toFixed(2);
      existing.closureCommissionPercent =
        trip.closure?.commissionPercent == null ? null : trip.closure.commissionPercent.toFixed(2);
      existing.closureRepCommission =
        trip.closure?.repCommission == null ? null : trip.closure.repCommission.toFixed(2);
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(TripOrmEntity, {
      id: trip.id,
      accountId: trip.accountId,
      companyId: trip.companyId,
      routeId: trip.routeId,
      salesRepId: trip.salesRepId,
      helperUserId: trip.helperUserId,
      status: trip.status,
      departureAt: trip.departureAt,
      returnAt: trip.returnAt,
      initialCash: trip.initialCash.toFixed(2),
      returnCash: trip.returnCash === null ? null : trip.returnCash.toFixed(2),
      initialKm: trip.initialKm === null ? null : trip.initialKm.toFixed(1),
      finalKm: trip.finalKm === null ? null : trip.finalKm.toFixed(1),
      loadLocationId: trip.loadLocationId,
      closureManagerUserId: null,
      closureManagerPercent: null,
      closureHelperAmount: null,
      closureCommissionPercent: null,
      closureRepCommission: null,
      createdAt: trip.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
