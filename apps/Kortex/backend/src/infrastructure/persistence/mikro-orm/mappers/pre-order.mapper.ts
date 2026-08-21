import { Injectable } from '@nestjs/common';
import {
  PreOrder,
  PreOrderStatus,
} from '../../../../contexts/pre-order/domain/entities/pre-order.entity';
import { PreOrderItem } from '../../../../contexts/pre-order/domain/entities/pre-order-item.entity';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { PreOrderItemId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-item-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { PreOrderOrmEntity } from '../entities/pre-order-orm.entity';
import { PreOrderItemOrmEntity } from '../entities/pre-order-item-orm.entity';

/**
 * Pedido ↔ ORM, com as matrizes junto.
 *
 * O pedido só existe inteiro: um pedido sem matriz não descreve trabalho nenhum (§4.7.1), então
 * as duas tabelas são lidas e gravadas como uma coisa só — o repositório carrega os itens antes
 * de chamar `toDomain`, e devolve os dois lados no `toOrm`.
 */
@Injectable()
export class PreOrderMapper {
  toDomain(orm: PreOrderOrmEntity, items: PreOrderItemOrmEntity[]): PreOrder {
    return PreOrder.restore({
      id: PreOrderId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      customerId: CustomerId.from(orm.customerId),
      items: items.map((item) => this.itemToDomain(item)),
      createdByUserId: UserId.from(orm.createdByUserId),
      estimate: {
        estimatedHours: orm.estimatedHours,
        notes: orm.notes,
      },
      status: orm.status as PreOrderStatus,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  itemToDomain(orm: PreOrderItemOrmEntity): PreOrderItem {
    return PreOrderItem.restore({
      id: PreOrderItemId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      sequence: orm.sequence,
      fabricId: FabricId.from(orm.fabricId),
      productTypeId: ProductTypeId.from(orm.productTypeId),
      estimate: {
        estimatedPieces: orm.estimatedPieces,
        // `numeric` chega como string do driver; a conversão acontece só aqui.
        metersPerPiece: orm.metersPerPiece === null ? null : Number(orm.metersPerPiece),
        rolls: orm.rolls,
        estimatedLayers: orm.estimatedLayers,
        estimatedLayoutType: orm.estimatedLayoutType as LayoutType | null,
      },
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: PreOrder, target: PreOrderOrmEntity = new PreOrderOrmEntity()): PreOrderOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.customerId = domain.customerId.value;
    target.createdByUserId = domain.createdByUserId.value;

    target.estimatedHours = domain.estimate.estimatedHours;
    target.notes = domain.estimate.notes;

    target.status = domain.status;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }

  itemToOrm(
    preOrderId: string,
    domain: PreOrderItem,
    target: PreOrderItemOrmEntity = new PreOrderItemOrmEntity(),
  ): PreOrderItemOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.preOrderId = preOrderId;
    target.sequence = domain.sequence;
    target.fabricId = domain.fabricId.value;
    target.productTypeId = domain.productTypeId.value;

    const estimate = domain.estimate;
    target.estimatedPieces = estimate.estimatedPieces;
    // Três casas para a coluna `numeric(8,3)`.
    target.metersPerPiece =
      estimate.metersPerPiece === null ? null : estimate.metersPerPiece.toFixed(3);
    target.rolls = estimate.rolls;
    target.estimatedLayers = estimate.estimatedLayers;
    target.estimatedLayoutType = estimate.estimatedLayoutType;

    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
