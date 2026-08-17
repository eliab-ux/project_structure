import { Injectable } from '@nestjs/common';
import {
  PreOrder,
  PreOrderStatus,
} from '../../../../contexts/pre-order/domain/entities/pre-order.entity';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { PreOrderOrmEntity } from '../entities/pre-order-orm.entity';

@Injectable()
export class PreOrderMapper {
  toDomain(orm: PreOrderOrmEntity): PreOrder {
    return PreOrder.restore({
      id: PreOrderId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      customerId: CustomerId.from(orm.customerId),
      fabricId: FabricId.from(orm.fabricId),
      productTypeId: ProductTypeId.from(orm.productTypeId),
      createdByUserId: UserId.from(orm.createdByUserId),
      estimate: {
        estimatedPieces: orm.estimatedPieces,
        metersPerPiece: orm.metersPerPiece === null ? null : Number(orm.metersPerPiece),
        rolls: orm.rolls,
        estimatedLayers: orm.estimatedLayers,
        estimatedLayoutType: orm.estimatedLayoutType as LayoutType | null,
        estimatedHours: orm.estimatedHours,
        notes: orm.notes,
      },
      status: orm.status as PreOrderStatus,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: PreOrder, target: PreOrderOrmEntity = new PreOrderOrmEntity()): PreOrderOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.customerId = domain.customerId.value;
    target.fabricId = domain.fabricId.value;
    target.productTypeId = domain.productTypeId.value;
    target.createdByUserId = domain.createdByUserId.value;

    const estimate = domain.estimate;
    target.estimatedPieces = estimate.estimatedPieces;
    // Três casas para a coluna `numeric(8,3)`.
    target.metersPerPiece =
      estimate.metersPerPiece === null ? null : estimate.metersPerPiece.toFixed(3);
    target.rolls = estimate.rolls;
    target.estimatedLayers = estimate.estimatedLayers;
    target.estimatedLayoutType = estimate.estimatedLayoutType;
    target.estimatedHours = estimate.estimatedHours;
    target.notes = estimate.notes;

    target.status = domain.status;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
