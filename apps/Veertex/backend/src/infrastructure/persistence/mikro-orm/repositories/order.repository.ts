import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import {
  ListOrdersFilter,
  OrderRepositoryPort,
} from '../../../../contexts/order/application/ports/output/order-repository.port';
import { Order } from '../../../../contexts/order/domain/entities/order.entity';
import { OrderId } from '../../../../contexts/order/domain/value-objects/order-id.vo';
import { OrderOrmEntity } from '../entities/order-orm.entity';
import { OrderItemOrmEntity } from '../entities/order-item-orm.entity';
import { OrderCounterOrmEntity } from '../entities/order-counter-orm.entity';
import { OrderMapper } from '../mappers/order.mapper';
import { TenantContextService } from '../../../security/tenant-context.service';

/**
 * Repositório de pedidos. Como nos demais: nenhum método recebe `accountId` — filtro global + RLS
 * escopam tudo. O `account_id` das linhas novas vem do agregado; o do CONTADOR (que não tem
 * agregado) vem do escopo de tenant estabelecido pelo token (`TenantContextService`), nunca de param.
 */
@Injectable()
export class MikroOrmOrderRepository implements OrderRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: OrderMapper,
    private readonly tenant: TenantContextService,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const orm = await this.em.findOne(OrderOrmEntity, { id: id.value }, { populate: ['items'] });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async list(filter: ListOrdersFilter): Promise<Order[]> {
    const termo = filter.search?.trim();
    const rows = await this.em.find(
      OrderOrmEntity,
      {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.companyId ? { companyId: filter.companyId } : {}),
        ...(filter.contactId ? { contactId: filter.contactId } : {}),
        ...(filter.salesRepId ? { salesRepId: filter.salesRepId } : {}),
        ...(filter.tripId ? { tripId: filter.tripId } : {}),
        ...(filter.referenceFrom || filter.referenceTo
          ? {
              referenceDate: {
                ...(filter.referenceFrom ? { $gte: filter.referenceFrom } : {}),
                ...(filter.referenceTo ? { $lte: filter.referenceTo } : {}),
              },
            }
          : {}),
        ...(termo && /^\d+$/.test(termo) ? { number: Number(termo) } : {}),
      },
      { populate: ['items'], orderBy: { number: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  /**
   * Sincroniza cabeçalho + itens por SUBSTITUIÇÃO com soft-delete (runtime não tem DELETE) — mesmo
   * padrão de Contato/Produto. Cada item novo recebe `account_id` explícito; sem ele o INSERT bate
   * na policy de RLS (comportamento correto da policy).
   */
  async save(order: Order): Promise<Order> {
    let orm: OrderOrmEntity | null = await this.em.findOne(
      OrderOrmEntity,
      { id: order.id.value },
      { populate: ['items'] },
    );

    if (!orm) {
      orm = this.em.create(OrderOrmEntity, {
        id: order.id.value,
        accountId: order.accountId,
        companyId: order.companyId,
        contactId: order.contactId,
        salesRepId: order.salesRepId,
        number: order.number,
        origin: order.origin,
        deliveryMode: order.deliveryMode,
        originDetail: order.originDetail,
        tripId: order.tripId,
        status: order.status,
        discountPercent: order.discountPercent.toFixed(2),
        discountValue: order.discountValue.toFixed(2),
        notes: order.notes,
        referenceDate: order.referenceDate,
        validUntil: order.validUntil,
        // Dormente (§4.1 do 02A): sempre 0 na criação; o fechamento de espécie chega com o PDV/TEF.
        paymentRounding: '0',
        createdAt: order.createdAt,
        updatedAt: new Date(),
      });
      this.em.persist(orm);
    } else {
      this.mapper.applyScalars(orm, order);
      if (!orm.items.isInitialized()) {
        await this.em.populate(orm, ['items']);
      }
    }

    const now = new Date();
    for (const antiga of orm.items.getItems()) {
      antiga.deletedAt = now;
    }
    for (const item of order.items) {
      orm.items.add(
        this.em.create(OrderItemOrmEntity, {
          id: item.id,
          accountId: order.accountId,
          order: orm,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity.toFixed(3),
          unitPrice: item.unitPrice.toFixed(2),
          discountPercent: item.discountPercent.toFixed(2),
          discountValue: item.discountValue.toFixed(2),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }

    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  /**
   * Próximo número da empresa, com lock pessimista na linha do contador (serializa a alocação).
   * O `account_id` da linha nova vem do escopo de tenant do token, não de parâmetro.
   */
  async nextOrderNumber(companyId: string): Promise<number> {
    const counter = await this.em.findOne(
      OrderCounterOrmEntity,
      { companyId },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!counter) {
      const created = this.em.create(OrderCounterOrmEntity, {
        id: randomUUID(),
        accountId: this.tenant.requireAccountId(),
        companyId,
        nextNumber: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      this.em.persist(created);
      await this.em.flush();
      return 1;
    }

    const number = counter.nextNumber;
    counter.nextNumber = number + 1;
    await this.em.flush();
    return number;
  }
}
