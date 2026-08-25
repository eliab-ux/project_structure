import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository, FilterQuery } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Commission } from '../../../../contexts/commission/domain/entities/commission.entity';
import { CommissionRule } from '../../../../contexts/commission/domain/entities/commission-rule.entity';
import {
  CommissionRepositoryPort,
  CommissionRuleRepositoryPort,
} from '../../../../contexts/commission/application/ports/output/commission-repository.port';
import { CommissionMapper } from '../mappers/commission.mapper';
import { CommissionOrmEntity } from '../entities/commission-orm.entity';
import { CommissionRuleOrmEntity } from '../entities/commission-rule-orm.entity';

@Injectable()
export class MikroOrmCommissionRepository implements CommissionRepositoryPort {
  constructor(
    @InjectRepository(CommissionOrmEntity)
    private readonly commissionRepository: EntityRepository<CommissionOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: CommissionMapper,
  ) {}

  async save(commission: Commission): Promise<Commission> {
    const orm = this.mapper.toOrm(commission);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findReadyToRelease(): Promise<Commission[]> {
    const now = new Date();
    const list = await this.commissionRepository.find({
      status: 'pending',
      availableAt: { $lte: now },
    });
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async getBalance(
    resellerId: string,
  ): Promise<{ pending: number; available: number; withdrawn: number; debt: number }> {
    const commissions = await this.commissionRepository.find({ resellerId });
    const balance = { pending: 0, available: 0, withdrawn: 0, debt: 0 };
    for (const commission of commissions) {
      const amount = Number(commission.amount);
      switch (commission.status) {
        case 'pending':
          balance.pending += amount;
          break;
        case 'available':
          balance.available += amount;
          break;
        case 'withdrawn':
          balance.withdrawn += amount;
          break;
        case 'reversed':
          balance.available -= amount;
          break;
        case 'debt':
          balance.debt += amount;
          break;
      }
    }
    return balance;
  }

  async getResellerMonthlySales(resellerId: string): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const commissions = await this.commissionRepository.find(
      { resellerId, createdAt: { $gte: start } },
      { fields: ['orderTotal'] },
    );

    return commissions.reduce((sum, commission) => sum + Number(commission.orderTotal), 0);
  }

  async findByResellerId(
    resellerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Commission[]> {
    const list = await this.commissionRepository.find(
      { resellerId },
      {
        orderBy: { createdAt: 'DESC' },
        limit: options?.limit,
        offset: options?.offset,
      },
    );
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findAll(options?: {
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Commission[]> {
    const where: FilterQuery<CommissionOrmEntity> = {};
    if (options?.status) {
      where.status = { $in: options.status };
    }

    const list = await this.commissionRepository.find(where, {
      orderBy: { createdAt: 'DESC' },
      limit: options?.limit,
      offset: options?.offset,
    });

    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findAvailableByReseller(resellerId: string): Promise<Commission[]> {
    const list = await this.commissionRepository.find(
      { resellerId, status: 'available' },
      {
        orderBy: { createdAt: 'DESC' },
      },
    );
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findByIds(ids: string[]): Promise<Commission[]> {
    if (ids.length === 0) {
      return [];
    }
    const list = await this.commissionRepository.find({ id: { $in: ids } });
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findByOrderId(orderId: string): Promise<Commission | null> {
    const orm = await this.commissionRepository.findOne({ orderId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await this.em.nativeDelete(CommissionOrmEntity, { orderId });
  }
}

@Injectable()
export class MikroOrmCommissionRuleRepository implements CommissionRuleRepositoryPort {
  constructor(
    @InjectRepository(CommissionRuleOrmEntity)
    private readonly repository: EntityRepository<CommissionRuleOrmEntity>,
    private readonly em: EntityManager,
  ) {}

  async findActive(): Promise<CommissionRule[]> {
    const rules = await this.findAll();
    return rules.filter((rule) => rule.isActive);
  }

  async findAll(): Promise<CommissionRule[]> {
    const rules = await this.repository.find({}, { orderBy: { minAmount: 'ASC' } });
    return rules.map(
      (rule) =>
        new CommissionRule(
          rule.id,
          Number(rule.minAmount),
          rule.maxAmount ?? null,
          Number(rule.percentage),
          rule.isActive,
        ),
    );
  }

  async syncRules(rules: CommissionRule[]): Promise<void> {
    await this.em.nativeDelete(CommissionRuleOrmEntity, {});

    const entities = rules.map((rule) => {
      const entity = new CommissionRuleOrmEntity();
      entity.id = rule.id;
      entity.minAmount = rule.minAmount;
      entity.maxAmount = rule.maxAmount ?? undefined;
      entity.percentage = rule.percentage;
      entity.isActive = rule.isActive;
      return entity;
    });

    await this.em.persistAndFlush(entities);
  }
}
