import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AccountRepositoryPort } from '../../../../contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';
import { AccountMapper } from '../mappers/account.mapper';

/**
 * `accounts` is not covered by the global tenant filter (it has no `account_id` — its `id` IS the
 * tenant), so isolation here rests entirely on the RLS policy, which compares `id` against
 * `app.account_id`. Under the runtime role, asking for another account's id returns nothing.
 */
@Injectable()
export class MikroOrmAccountRepository implements AccountRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: AccountMapper,
  ) {}

  async findById(id: AccountId): Promise<Account | null> {
    const orm = await this.em.findOne(AccountOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByDocument(document: string): Promise<Account | null> {
    const orm = await this.em.findOne(AccountOrmEntity, { document });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(account: Account): Promise<Account> {
    // upsert: no prior SELECT, so it also works during onboarding, before the row exists.
    const orm = await this.em.upsert(AccountOrmEntity, this.mapper.toOrmData(account));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}
