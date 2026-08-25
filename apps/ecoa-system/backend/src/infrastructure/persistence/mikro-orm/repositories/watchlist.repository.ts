import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { WatchlistRepositoryPort } from '../../../../contexts/watchlist/application/ports/output/watchlist-repository.port';
import { WatchedAccount } from '../../../../contexts/watchlist/domain/entities/watched-account.entity';
import { WatchedAccountOrmEntity } from '../entities/watched-account-orm.entity';
import { WatchedAccountMapper } from '../mappers/watched-account.mapper';

@Injectable()
export class MikroOrmWatchlistRepository implements WatchlistRepositoryPort {
  constructor(
    @InjectRepository(WatchedAccountOrmEntity)
    private readonly repository: EntityRepository<WatchedAccountOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WatchedAccountMapper,
  ) {}

  async save(account: WatchedAccount): Promise<WatchedAccount> {
    const existing = await this.repository.findOne({
      id: account.id.value,
      ownerId: account.ownerId,
    });
    const orm = this.mapper.toOrm(account, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findByOwner(ownerId: string): Promise<WatchedAccount[]> {
    const rows = await this.repository.find({ ownerId }, { orderBy: { addedAt: 'DESC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async findById(ownerId: string, id: string): Promise<WatchedAccount | null> {
    const orm = await this.repository.findOne({ id, ownerId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async delete(ownerId: string, id: string): Promise<void> {
    const orm = await this.repository.findOne({ id, ownerId });
    if (orm) {
      await this.em.removeAndFlush(orm);
    }
  }

  async findByOwnerAndHandle(ownerId: string, handle: string): Promise<WatchedAccount | null> {
    const orm = await this.repository.findOne({ ownerId, handle: handle.toLowerCase() });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findUnresolvedByOwner(ownerId: string): Promise<WatchedAccount[]> {
    const rows = await this.repository.find({ ownerId, igUserId: null, active: true });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async findByOwnerAndSourceUsername(
    ownerId: string,
    username: string,
  ): Promise<WatchedAccount | null> {
    // A reshare/mention carries the source account's username; a watched account is keyed by
    // its handle (stored lowercased, without '@'), so username matches handle when lowercased.
    const orm = await this.repository.findOne({ ownerId, handle: username.toLowerCase() });
    return orm ? this.mapper.toDomain(orm) : null;
  }
}
