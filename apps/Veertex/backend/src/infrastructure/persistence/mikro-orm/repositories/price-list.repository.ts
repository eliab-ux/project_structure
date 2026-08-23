import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PriceListRepositoryPort } from '../../../../contexts/price-list/application/ports/output/price-list-repository.port';
import { PriceList } from '../../../../contexts/price-list/domain/entities/price-list.entity';
import { PriceListItem } from '../../../../contexts/price-list/domain/entities/price-list-item.entity';
import { PriceListOrmEntity } from '../entities/price-list-orm.entity';
import { PriceListItemOrmEntity } from '../entities/price-list-item-orm.entity';

/**
 * Repositório de tabelas de preço. Sem `accountId` nos métodos — filtro global + RLS escopam. Itens
 * sincronizados por SUBSTITUIÇÃO com soft-delete (runtime não tem DELETE), igual ao pedido.
 */
@Injectable()
export class MikroOrmPriceListRepository implements PriceListRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: PriceListOrmEntity): PriceList {
    const items = orm.items.getItems().map((item) =>
      PriceListItem.create({
        id: item.id,
        productId: item.productId,
        price: Number(item.price),
        minQuantity: item.minQuantity,
      }),
    );
    return PriceList.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      active: orm.active,
      contactId: orm.contactId,
      salesRepId: orm.salesRepId,
      items,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<PriceList | null> {
    const orm = await this.em.findOne(PriceListOrmEntity, { id }, { populate: ['items'] });
    return orm ? this.toDomain(orm) : null;
  }

  async list(includeInactive: boolean): Promise<PriceList[]> {
    const rows = await this.em.find(
      PriceListOrmEntity,
      { ...(includeInactive ? {} : { active: true }) },
      { populate: ['items'], orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findActiveByContact(contactId: string): Promise<PriceList[]> {
    const rows = await this.em.find(
      PriceListOrmEntity,
      { contactId, active: true },
      { populate: ['items'] },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findActiveBySalesRep(salesRepId: string): Promise<PriceList[]> {
    const rows = await this.em.find(
      PriceListOrmEntity,
      { salesRepId, active: true },
      { populate: ['items'] },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(priceList: PriceList): Promise<PriceList> {
    let orm: PriceListOrmEntity | null = await this.em.findOne(
      PriceListOrmEntity,
      { id: priceList.id },
      { populate: ['items'] },
    );

    if (!orm) {
      orm = this.em.create(PriceListOrmEntity, {
        id: priceList.id,
        accountId: priceList.accountId,
        name: priceList.name,
        active: priceList.active,
        contactId: priceList.contactId,
        salesRepId: priceList.salesRepId,
        createdAt: priceList.createdAt,
        updatedAt: new Date(),
        deletedAt: null,
      });
      this.em.persist(orm);
    } else {
      orm.name = priceList.name;
      orm.active = priceList.active;
      orm.contactId = priceList.contactId;
      orm.salesRepId = priceList.salesRepId;
      orm.updatedAt = new Date();
      if (!orm.items.isInitialized()) {
        await this.em.populate(orm, ['items']);
      }
    }

    const now = new Date();
    for (const antigo of orm.items.getItems()) {
      antigo.deletedAt = now;
    }
    for (const item of priceList.items) {
      orm.items.add(
        this.em.create(PriceListItemOrmEntity, {
          id: item.id,
          accountId: priceList.accountId,
          priceList: orm,
          productId: item.productId,
          price: item.price.toFixed(2),
          minQuantity: item.minQuantity,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }

    await this.em.flush();
    return this.toDomain(orm);
  }
}
