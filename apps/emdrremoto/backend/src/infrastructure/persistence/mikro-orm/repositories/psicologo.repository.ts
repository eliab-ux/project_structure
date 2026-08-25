import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { PsicologoRepositoryPort } from '../../../../contexts/psicologo/application/ports/output/psicologo-repository.port';
import { Psicologo } from '../../../../contexts/psicologo/domain/entities/psicologo.entity';
import { PsicologoId } from '../../../../contexts/psicologo/domain/value-objects/psicologo-id.vo';
import { Email } from '../../../../contexts/psicologo/domain/value-objects/email.vo';
import { PsicologoOrmEntity } from '../entities/psicologo-orm.entity';
import { PsicologoMapper } from '../mappers/psicologo.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmPsicologoRepository implements PsicologoRepositoryPort {
  constructor(
    @InjectRepository(PsicologoOrmEntity)
    private readonly repository: EntityRepository<PsicologoOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PsicologoMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(psicologo: Psicologo): Promise<Psicologo> {
    const existing = await this.repository.findOne({ id: psicologo.id.value });
    const orm = this.mapper.toOrm(psicologo, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const events = psicologo.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async findById(id: PsicologoId): Promise<Psicologo | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByEmail(email: Email): Promise<Psicologo | null> {
    const orm = await this.repository.findOne({ email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByRecoveryCode(code: string): Promise<Psicologo | null> {
    const orm = await this.repository.findOne({ recoveryCode: code });
    return orm ? this.mapper.toDomain(orm) : null;
  }
}
