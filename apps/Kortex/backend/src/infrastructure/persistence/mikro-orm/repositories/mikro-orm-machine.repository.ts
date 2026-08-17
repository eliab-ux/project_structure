import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { MachineRepositoryPort } from '../../../../contexts/machine/application/ports/output/machine-repository.port';
import { Machine } from '../../../../contexts/machine/domain/entities/machine.entity';
import { MachineId } from '../../../../contexts/machine/domain/value-objects/machine-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { MachineOrmEntity } from '../entities/machine-orm.entity';
import { MachineMapper } from '../mappers/machine.mapper';

@Injectable()
export class MikroOrmMachineRepository implements MachineRepositoryPort {
  constructor(
    @InjectRepository(MachineOrmEntity)
    private readonly repo: EntityRepository<MachineOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: MachineMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<Machine[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      // Ativas primeiro, e depois por nome: a tela de Configuração lista as que aceitam reserva
      // antes das que só guardam histórico.
      { orderBy: { isActive: 'DESC', name: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: MachineId): Promise<Machine | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(machine: Machine): Promise<Machine> {
    const existing = await this.repo.findOne({
      accountId: machine.accountId.value,
      id: machine.id.value,
    });
    const orm = this.mapper.toOrm(machine, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
