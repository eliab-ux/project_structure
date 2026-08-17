import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  FabricRepositoryPort,
  ProductTypeRepositoryPort,
} from '../../../../contexts/catalog/application/ports/output/catalog-repository.port';
import { Fabric } from '../../../../contexts/catalog/domain/entities/fabric.entity';
import { ProductType } from '../../../../contexts/catalog/domain/entities/product-type.entity';
import { FabricId } from '../../../../contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../../contexts/catalog/domain/value-objects/product-type-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { FabricOrmEntity } from '../entities/fabric-orm.entity';
import { ProductTypeOrmEntity } from '../entities/product-type-orm.entity';
import { FabricMapper, ProductTypeMapper } from '../mappers/catalog.mapper';

@Injectable()
export class MikroOrmFabricRepository implements FabricRepositoryPort {
  constructor(
    @InjectRepository(FabricOrmEntity)
    private readonly repo: EntityRepository<FabricOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: FabricMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<Fabric[]> {
    const rows = await this.repo.find({ accountId: accountId.value }, { orderBy: { name: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: FabricId): Promise<Fabric | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByName(accountId: AccountId, name: string): Promise<Fabric | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, name });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(fabric: Fabric): Promise<Fabric> {
    const existing = await this.repo.findOne({
      accountId: fabric.accountId.value,
      id: fabric.id.value,
    });
    const orm = this.mapper.toOrm(fabric, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmProductTypeRepository implements ProductTypeRepositoryPort {
  constructor(
    @InjectRepository(ProductTypeOrmEntity)
    private readonly repo: EntityRepository<ProductTypeOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ProductTypeMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<ProductType[]> {
    const rows = await this.repo.find({ accountId: accountId.value }, { orderBy: { name: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: ProductTypeId): Promise<ProductType | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByName(accountId: AccountId, name: string): Promise<ProductType | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, name });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(productType: ProductType): Promise<ProductType> {
    const existing = await this.repo.findOne({
      accountId: productType.accountId.value,
      id: productType.id.value,
    });
    const orm = this.mapper.toOrm(productType, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
