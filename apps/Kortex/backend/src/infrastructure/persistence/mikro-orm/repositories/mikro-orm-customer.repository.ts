import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { CustomerRepositoryPort } from '../../../../contexts/customer/application/ports/output/customer-repository.port';
import { Customer } from '../../../../contexts/customer/domain/entities/customer.entity';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { CustomerDocument } from '../../../../contexts/customer/domain/value-objects/customer-document.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { CustomerOrmEntity } from '../entities/customer-orm.entity';
import { CustomerMapper } from '../mappers/customer.mapper';

@Injectable()
export class MikroOrmCustomerRepository implements CustomerRepositoryPort {
  constructor(
    @InjectRepository(CustomerOrmEntity)
    private readonly repo: EntityRepository<CustomerOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: CustomerMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<Customer[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      // Ativos primeiro, depois por nome fantasia — é o nome fantasia que aparece na agenda e no
      // relatório, então é por ele que o operador procura.
      { orderBy: { status: 'ASC', tradeName: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async listActiveByAccount(accountId: AccountId): Promise<Customer[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, status: 'active' },
      { orderBy: { tradeName: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: CustomerId): Promise<Customer | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByDocument(accountId: AccountId, document: CustomerDocument): Promise<Customer | null> {
    // Compara só dígitos, que é como a coluna guarda — ver o docblock de `CustomerDocument`.
    const orm = await this.repo.findOne({
      accountId: accountId.value,
      document: document.value,
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(customer: Customer): Promise<Customer> {
    const existing = await this.repo.findOne({
      accountId: customer.accountId.value,
      id: customer.id.value,
    });
    const orm = this.mapper.toOrm(customer, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
