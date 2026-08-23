import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { FinancialAccountRepositoryPort } from '../../../../contexts/finance/application/ports/output/financial-account-repository.port';
import { FinancialAccount } from '../../../../contexts/finance/domain/entities/financial-account.entity';
import { FinancialAccountType } from '../../../../contexts/finance/domain/financial-account-type';
import { FinancialAccountOrmEntity } from '../entities/financial-account-orm.entity';

@Injectable()
export class MikroOrmFinancialAccountRepository implements FinancialAccountRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: FinancialAccountOrmEntity): FinancialAccount {
    return FinancialAccount.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      type: orm.type as FinancialAccountType,
      institution: orm.institution,
      initialBalance: Number(orm.initialBalance),
      automatic: orm.automatic,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<FinancialAccount | null> {
    const orm = await this.em.findOne(FinancialAccountOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async list(includeInactive: boolean): Promise<FinancialAccount[]> {
    const rows = await this.em.find(
      FinancialAccountOrmEntity,
      { ...(includeInactive ? {} : { active: true }) },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(account: FinancialAccount): Promise<FinancialAccount> {
    const existing = await this.em.findOne(FinancialAccountOrmEntity, { id: account.id });
    if (existing) {
      existing.name = account.name;
      existing.institution = account.institution;
      existing.active = account.active;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(FinancialAccountOrmEntity, {
      id: account.id,
      accountId: account.accountId,
      name: account.name,
      type: account.type,
      institution: account.institution,
      initialBalance: account.initialBalance.toFixed(2),
      automatic: account.automatic,
      active: account.active,
      createdAt: account.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
