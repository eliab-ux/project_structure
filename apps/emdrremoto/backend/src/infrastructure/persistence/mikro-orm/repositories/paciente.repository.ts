import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { PacienteRepositoryPort } from '../../../../contexts/paciente/application/ports/output/paciente-repository.port';
import { Paciente } from '../../../../contexts/paciente/domain/entities/paciente.entity';
import { PacienteId } from '../../../../contexts/paciente/domain/value-objects/paciente-id.vo';
import { PacienteOrmEntity } from '../entities/paciente-orm.entity';
import { PacienteMapper } from '../mappers/paciente.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmPacienteRepository implements PacienteRepositoryPort {
  constructor(
    @InjectRepository(PacienteOrmEntity)
    private readonly repository: EntityRepository<PacienteOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PacienteMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(paciente: Paciente): Promise<Paciente> {
    const existing = await this.repository.findOne({ id: paciente.id.value });
    const orm = this.mapper.toOrm(paciente, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const events = paciente.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async findById(id: PacienteId): Promise<Paciente | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByHash(hash: string): Promise<Paciente | null> {
    const orm = await this.repository.findOne({ hash });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByPsicologo(psicologoId: string): Promise<Paciente[]> {
    const list = await this.repository.find({ psicologoId }, { orderBy: { createdAt: 'DESC' } });
    return list.map((orm) => this.mapper.toDomain(orm));
  }

  async delete(id: PacienteId): Promise<void> {
    const orm = await this.repository.findOne({ id: id.value });
    if (orm) {
      await this.em.removeAndFlush(orm);
    }
  }
}
