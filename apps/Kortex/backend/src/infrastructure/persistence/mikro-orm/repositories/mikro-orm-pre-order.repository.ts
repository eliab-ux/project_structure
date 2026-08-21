import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { PreOrderRepositoryPort } from '../../../../contexts/pre-order/application/ports/output/pre-order-repository.port';
import {
  PreOrder,
  PreOrderStatus,
} from '../../../../contexts/pre-order/domain/entities/pre-order.entity';
import { PreOrderItem } from '../../../../contexts/pre-order/domain/entities/pre-order-item.entity';
import { PreOrderId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-id.vo';
import { PreOrderItemId } from '../../../../contexts/pre-order/domain/value-objects/pre-order-item-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { PreOrderOrmEntity } from '../entities/pre-order-orm.entity';
import { PreOrderItemOrmEntity } from '../entities/pre-order-item-orm.entity';
import { PreOrderMapper } from '../mappers/pre-order.mapper';

@Injectable()
export class MikroOrmPreOrderRepository implements PreOrderRepositoryPort {
  constructor(
    @InjectRepository(PreOrderOrmEntity)
    private readonly repo: EntityRepository<PreOrderOrmEntity>,
    @InjectRepository(PreOrderItemOrmEntity)
    private readonly items: EntityRepository<PreOrderItemOrmEntity>,
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
    return this.withItems(accountId, rows);
  }

  async listByCreator(accountId: AccountId, createdBy: UserId): Promise<PreOrder[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, createdByUserId: createdBy.value },
      { orderBy: { createdAt: 'DESC' } },
    );
    return this.withItems(accountId, rows);
  }

  async countOpen(accountId: AccountId): Promise<number> {
    return this.repo.count({ accountId: accountId.value, status: 'open' });
  }

  async findById(accountId: AccountId, id: PreOrderId): Promise<PreOrder | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    if (!orm) {
      return null;
    }
    return (await this.withItems(accountId, [orm]))[0];
  }

  async findItemsByIds(accountId: AccountId, ids: PreOrderItemId[]): Promise<PreOrderItem[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.items.find(
      { accountId: accountId.value, id: { $in: ids.map((id) => id.value) } },
      { orderBy: { sequence: 'ASC' } },
    );
    return rows.map((row) => this.mapper.itemToDomain(row));
  }

  /**
   * Salva o pedido e as matrizes como uma coisa só.
   *
   * As matrizes são **substituídas por inteiro**: o domínio já as reconstrói a cada edição (o
   * pedido está `open`, nada foi apontado), então casar linha a linha aqui só criaria a ilusão de
   * continuidade sobre registros que ninguém usou.
   */
  async save(preOrder: PreOrder): Promise<PreOrder> {
    const accountId = preOrder.accountId;

    const existing = await this.repo.findOne({
      accountId: accountId.value,
      id: preOrder.id.value,
    });
    const orm = this.mapper.toOrm(preOrder, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const anteriores = await this.items.find({
      accountId: accountId.value,
      preOrderId: preOrder.id.value,
    });
    const mantidos = new Set(preOrder.items.map((item) => item.id.value));
    for (const antigo of anteriores) {
      if (!mantidos.has(antigo.id)) {
        this.em.remove(antigo);
      }
    }

    const porId = new Map(anteriores.map((linha) => [linha.id, linha]));
    for (const item of preOrder.items) {
      this.em.persist(this.mapper.itemToOrm(preOrder.id.value, item, porId.get(item.id.value)));
    }
    await this.em.flush();

    return (await this.withItems(accountId, [orm]))[0];
  }

  /**
   * Carrega as matrizes de vários pedidos em UMA consulta.
   *
   * Uma consulta por pedido faria a lista do Administrativo, com 30 pedidos abertos, dar 31 idas
   * ao banco para desenhar uma tela.
   */
  private async withItems(accountId: AccountId, rows: PreOrderOrmEntity[]): Promise<PreOrder[]> {
    if (rows.length === 0) {
      return [];
    }

    const linhas = await this.items.find(
      { accountId: accountId.value, preOrderId: { $in: rows.map((row) => row.id) } },
      { orderBy: { sequence: 'ASC' } },
    );

    const porPedido = new Map<string, PreOrderItemOrmEntity[]>();
    for (const linha of linhas) {
      const lista = porPedido.get(linha.preOrderId) ?? [];
      lista.push(linha);
      porPedido.set(linha.preOrderId, lista);
    }

    return rows.map((row) => this.mapper.toDomain(row, porPedido.get(row.id) ?? []));
  }
}
