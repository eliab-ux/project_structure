import { Injectable } from '@nestjs/common';
import { StockMovement } from '../../../../contexts/stock/domain/entities/stock-movement.entity';
import { StockMovementType } from '../../../../contexts/stock/domain/movement-type';
import { StockMovementOrmEntity } from '../entities/stock-movement-orm.entity';

@Injectable()
export class StockMovementMapper {
  toDomain(orm: StockMovementOrmEntity): StockMovement {
    return StockMovement.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      productId: orm.productId,
      type: orm.type as StockMovementType,
      signedQuantity: Number(orm.signedQuantity),
      unitCost: orm.unitCost === null ? null : Number(orm.unitCost),
      relatedMovementId: orm.relatedMovementId,
      usedFallback: orm.usedFallback,
      note: orm.note,
      occurredAt: orm.occurredAt,
      createdAt: orm.createdAt,
    });
  }
}
