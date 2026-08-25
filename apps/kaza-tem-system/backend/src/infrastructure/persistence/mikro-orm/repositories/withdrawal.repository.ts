import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Withdrawal } from '@contexts/withdrawal/domain/entities/withdrawal.entity';
import { WithdrawalId } from '@contexts/withdrawal/domain/value-objects/withdrawal-id.vo';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import { WithdrawalRepositoryPort } from '@contexts/withdrawal/application/ports/output/withdrawal-repository.port';
import { WithdrawalMapper } from '../mappers/withdrawal.mapper';
import { WithdrawalOrmEntity } from '../entities/withdrawal-orm.entity';

@Injectable()
export class MikroOrmWithdrawalRepository implements WithdrawalRepositoryPort {
  constructor(
    @InjectRepository(WithdrawalOrmEntity)
    private readonly repository: EntityRepository<WithdrawalOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WithdrawalMapper,
  ) {}

  async save(withdrawal: Withdrawal): Promise<Withdrawal> {
    const orm = this.mapper.toOrm(withdrawal);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findById(id: WithdrawalId): Promise<Withdrawal | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByStatus(
    status: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Withdrawal[]> {
    const list = await this.repository.find(
      { status },
      {
        orderBy: { createdAt: 'DESC' },
        limit: options?.limit,
        offset: options?.offset,
      },
    );
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async findByReseller(resellerId: ResellerId): Promise<Withdrawal[]> {
    const list = await this.repository.find(
      { resellerId: resellerId.value },
      {
        orderBy: { createdAt: 'DESC' },
      },
    );
    return list.map((entity) => this.mapper.toDomain(entity));
  }

  async hasPendingWithdrawal(resellerId: ResellerId): Promise<boolean> {
    const exists = await this.repository.findOne({
      resellerId: resellerId.value,
      status: 'requested',
    });
    return !!exists;
  }
}
