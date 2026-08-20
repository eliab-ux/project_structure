import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { PreOrderRepositoryPort } from '../../../../contexts/pre-order/application/ports/output/pre-order-repository.port';
import {
  PreOrder,
  PreOrderStatus,
} from '../../../../contexts/pre-order/domain/entities/pre-order.entity';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { PreOrderOrmEntity } from '../entities/pre-order-orm.entity';
import { PreOrderMapper } from '../mappers/pre-order.mapper';

@Injectable()
export class MikroOrmPreOrderRepository implements PreOrderRepositoryPort {
  constructor(
    @InjectRepository(PreOrderOrmEntity)
    private readonly repo: EntityRepository<PreOrderOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PreOrderMapper,
  ) {}

  async listByAccount(accountId: AccountId, statuses?: PreOrderStatus[]): Promise<PreOrder[]> {
    /**
     * O filtro é montado INLINE, e não numa variável passada adiante.
     *
     * Não é estilo: o verificador `check:tenant-scope` lê o argumento da chamada, e um `where`
     * construído fora dela esconde o escopo justamente de quem existe para conferi-lo. Quem lê o
     * código tem o mesmo problema — a linha `this.repo.find(where)` não diz nada sobre conta.
     */
    const rows = await this.repo.find(
      {
        accountId: accountId.value,
        ...(statuses && statuses.length > 0 ? { status: { $in: statuses } } : {}),
      },
      { orderBy: { createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async listByCreator(accountId: AccountId, createdBy: UserId): Promise<PreOrder[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, createdByUserId: createdBy.value },
      { orderBy: { createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async countOpen(accountId: AccountId): Promise<number> {
    return this.repo.count({ accountId: accountId.value, status: 'open' });
  }

  async findById(accountId: AccountId, id: PreOrderId): Promise<PreOrder | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(preOrder: PreOrder): Promise<PreOrder> {
    const existing = await this.repo.findOne({
      accountId: preOrder.accountId.value,
      id: preOrder.id.value,
    });
    const orm = this.mapper.toOrm(preOrder, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
