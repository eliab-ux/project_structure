import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CustomerCreditRepositoryPort } from '../../../../contexts/finance/application/ports/output/customer-credit-repository.port';
import {
  CustomerCredit,
  CustomerCreditStatus,
} from '../../../../contexts/finance/domain/entities/customer-credit.entity';
import { CustomerCreditOrmEntity } from '../entities/customer-credit-orm.entity';

/** Repositório do crédito do cliente — dormente até o FIS; ver o port. */
@Injectable()
export class MikroOrmCustomerCreditRepository implements CustomerCreditRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: CustomerCreditOrmEntity): CustomerCredit {
    return CustomerCredit.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      contactId: orm.contactId,
      originTitleId: orm.originTitleId,
      amount: Number(orm.amount),
      remainingAmount: Number(orm.remainingAmount),
      status: orm.status as CustomerCreditStatus,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<CustomerCredit | null> {
    const orm = await this.em.findOne(CustomerCreditOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async listOpenByContact(contactId: string): Promise<CustomerCredit[]> {
    const rows = await this.em.find(
      CustomerCreditOrmEntity,
      { contactId, status: 'open' },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(credit: CustomerCredit): Promise<CustomerCredit> {
    const existing = await this.em.findOne(CustomerCreditOrmEntity, { id: credit.id });
    if (existing) {
      existing.remainingAmount = credit.remainingAmount.toFixed(2);
      existing.status = credit.status;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(CustomerCreditOrmEntity, {
      id: credit.id,
      accountId: credit.accountId,
      companyId: credit.companyId,
      contactId: credit.contactId,
      originTitleId: credit.originTitleId,
      amount: credit.amount.toFixed(2),
      remainingAmount: credit.remainingAmount.toFixed(2),
      status: credit.status,
      createdAt: credit.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
