import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { AccountRepositoryPort } from '../../../../contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';
import { AccountMapper } from '../mappers/account.mapper';

/**
 * `account` é a única tabela sem coluna `account_id`: ela É a conta, e o `id` é a própria chave de
 * escopo. Buscar por `id` aqui já é buscar dentro do tenant.
 */
@Injectable()
export class MikroOrmAccountRepository implements AccountRepositoryPort {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly repo: EntityRepository<AccountOrmEntity>,
    // O EntityManager é injetado porque `EntityRepository` NÃO tem `persistAndFlush`
    // (CLAUDE.md, armadilha 3).
    private readonly em: EntityManager,
    private readonly mapper: AccountMapper,
  ) {}

  async findById(id: AccountId): Promise<Account | null> {
    const orm = await this.repo.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(account: Account): Promise<Account> {
    const existing = await this.repo.findOne({ id: account.id.value });
    const orm = this.mapper.toOrm(account, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
