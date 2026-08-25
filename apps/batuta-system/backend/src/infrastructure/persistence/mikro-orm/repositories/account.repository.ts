import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaginatedResult, Pagination } from '@gitspread/shared-kernel';
import {
  AccountRepositoryPort,
  ListAccountsFilter,
} from '../../../../contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';
import { AccountMapper } from '../mappers/account.mapper';

/**
 * `accounts` is not covered by the tenant filter (it has no `account_id` — its id IS the tenant),
 * so scoping here is the caller's contract: `findById` is always called with the accountId from the
 * JWT, and `listForPlatform` is only reachable behind PlatformAdminGuard.
 *
 * Writes go through `em.upsert` rather than read-modify-flush. Two reasons: it is a single
 * statement (INSERT … ON CONFLICT DO UPDATE), and it needs no prior SELECT — which matters at
 * login time, when there is no tenant scope established yet and a filtered read would throw.
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

  async existsByDocument(document: string): Promise<boolean> {
    const count = await this.em.count(AccountOrmEntity, { document });
    return count > 0;
  }

  async save(account: Account): Promise<Account> {
    const orm = await this.em.upsert(AccountOrmEntity, this.mapper.toOrmData(account));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async listForPlatform(filter: ListAccountsFilter): Promise<PaginatedResult<Account>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search?.trim()) {
      // Parameterized by MikroORM — never string concatenation.
      const term = `%${filter.search.trim()}%`;
      where.$or = [{ name: { $ilike: term } }, { document: { $like: term } }];
    }

    const [rows, total] = await this.em.findAndCount(AccountOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: { createdAt: 'DESC' },
    });

    return Pagination.createResult(
      rows.map((orm) => this.mapper.toDomain(orm)),
      total,
      params,
    );
  }
}
