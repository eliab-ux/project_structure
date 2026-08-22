import { Injectable } from '@nestjs/common';
import {
  ReleaseReason,
  ReservationStatus,
  StockReservation,
} from '../../../../contexts/stock/domain/entities/stock-reservation.entity';
import { StockReservationOrmEntity } from '../entities/stock-reservation-orm.entity';

@Injectable()
export class StockReservationMapper {
  toDomain(orm: StockReservationOrmEntity): StockReservation {
    return StockReservation.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      productId: orm.productId,
      orderId: orm.orderId,
      quantity: Number(orm.quantity),
      status: orm.status as ReservationStatus,
      releaseReason: (orm.releaseReason as ReleaseReason | null) ?? null,
      expiresAt: orm.expiresAt,
      createdAt: orm.createdAt,
    });
  }
}
