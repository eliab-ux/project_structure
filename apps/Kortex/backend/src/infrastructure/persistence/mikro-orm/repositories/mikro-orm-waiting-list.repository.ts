import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import {
  SlotNoticeRepositoryPort,
  WaitingListRepositoryPort,
} from '../../../../contexts/waiting-list/application/ports/output/waiting-list-repository.port';
import { WaitingListEntry } from '../../../../contexts/waiting-list/domain/entities/waiting-list-entry.entity';
import { SlotNotice } from '../../../../contexts/waiting-list/domain/entities/slot-notice.entity';
import { WaitingListEntryId } from '../../../../contexts/waiting-list/domain/value-objects/waiting-list-entry-id.vo';
import { SlotNoticeId } from '../../../../contexts/waiting-list/domain/value-objects/slot-notice-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { WaitingListEntryOrmEntity } from '../entities/waiting-list-entry-orm.entity';
import { SlotNoticeOrmEntity } from '../entities/slot-notice-orm.entity';
import { SlotNoticeMapper, WaitingListMapper } from '../mappers/waiting-list.mapper';

@Injectable()
export class MikroOrmWaitingListRepository implements WaitingListRepositoryPort {
  constructor(
    @InjectRepository(WaitingListEntryOrmEntity)
    private readonly repo: EntityRepository<WaitingListEntryOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WaitingListMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<WaitingListEntry[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      /**
       * Quem **quer antecipar** primeiro, depois por ordem de chegada.
       *
       * A ordenação é regra, não estética: o encaixe vem sempre da fila (2.15) e nunca
       * antecipando quem já está agendado (6.8), então a primeira pergunta do Administrativo
       * quando vaga um horário é "quem queria antecipar?". A lista já responde.
       */
      { orderBy: { wantsEarlier: 'DESC', createdAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async countPending(accountId: AccountId): Promise<number> {
    return this.repo.count({
      accountId: accountId.value,
      status: { $in: ['waiting', 'offered'] },
    });
  }

  async findById(accountId: AccountId, id: WaitingListEntryId): Promise<WaitingListEntry | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(entry: WaitingListEntry): Promise<WaitingListEntry> {
    const existing = await this.repo.findOne({
      accountId: entry.accountId.value,
      id: entry.id.value,
    });
    const orm = this.mapper.toOrm(entry, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}

@Injectable()
export class MikroOrmSlotNoticeRepository implements SlotNoticeRepositoryPort {
  constructor(
    @InjectRepository(SlotNoticeOrmEntity)
    private readonly repo: EntityRepository<SlotNoticeOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: SlotNoticeMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<SlotNotice[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      // Abertos primeiro: é uma lista de pendências, e pendência resolvida sai do caminho.
      { orderBy: { status: 'ASC', createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async countOpen(accountId: AccountId): Promise<number> {
    return this.repo.count({ accountId: accountId.value, status: 'open' });
  }

  async findById(accountId: AccountId, id: SlotNoticeId): Promise<SlotNotice | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(notice: SlotNotice): Promise<SlotNotice> {
    const existing = await this.repo.findOne({
      accountId: notice.accountId.value,
      id: notice.id.value,
    });
    const orm = this.mapper.toOrm(notice, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
