import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { FinancialCategoryRepositoryPort } from '../../../../contexts/finance/application/ports/output/financial-category-repository.port';
import { FinancialCategory } from '../../../../contexts/finance/domain/entities/financial-category.entity';
import { CategoryKind, CategoryOperation } from '../../../../contexts/finance/domain/category-kind';
import { FinancialCategoryOrmEntity } from '../entities/financial-category-orm.entity';

@Injectable()
export class MikroOrmFinancialCategoryRepository implements FinancialCategoryRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: FinancialCategoryOrmEntity): FinancialCategory {
    return FinancialCategory.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      kind: orm.kind as CategoryKind,
      parentId: orm.parentId,
      dreLine: orm.dreLine,
      defaultOperation: orm.defaultOperation as CategoryOperation | null,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  private newOrm(category: FinancialCategory): FinancialCategoryOrmEntity {
    return this.em.create(FinancialCategoryOrmEntity, {
      id: category.id,
      accountId: category.accountId,
      name: category.name,
      kind: category.kind,
      parentId: category.parentId,
      dreLine: category.dreLine,
      defaultOperation: category.defaultOperation,
      active: category.active,
      createdAt: category.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findById(id: string): Promise<FinancialCategory | null> {
    const orm = await this.em.findOne(FinancialCategoryOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async list(includeInactive: boolean): Promise<FinancialCategory[]> {
    const rows = await this.em.find(
      FinancialCategoryOrmEntity,
      { ...(includeInactive ? {} : { active: true }) },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findByDefaultOperation(operation: string): Promise<FinancialCategory | null> {
    const orm = await this.em.findOne(FinancialCategoryOrmEntity, {
      defaultOperation: operation,
      active: true,
    });
    return orm ? this.toDomain(orm) : null;
  }

  async save(category: FinancialCategory): Promise<FinancialCategory> {
    const existing = await this.em.findOne(FinancialCategoryOrmEntity, { id: category.id });
    if (existing) {
      existing.name = category.name;
      existing.parentId = category.parentId;
      existing.dreLine = category.dreLine;
      existing.defaultOperation = category.defaultOperation;
      existing.active = category.active;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.newOrm(category);
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }

  async saveAll(categories: FinancialCategory[]): Promise<void> {
    for (const category of categories) {
      this.em.persist(this.newOrm(category));
    }
    await this.em.flush();
  }
}
