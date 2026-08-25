import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { SessionRepositoryPort } from '../../../../contexts/session/application/ports/output/session-repository.port';
import { Session } from '../../../../contexts/session/domain/entities/session.entity';
import { SessionId } from '../../../../contexts/session/domain/value-objects/session-id.vo';
import { SessionOrmEntity } from '../entities/session-orm.entity';
import { SessionMapper } from '../mappers/session.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmSessionRepository implements SessionRepositoryPort {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly repository: EntityRepository<SessionOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: SessionMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(session: Session): Promise<Session> {
    const existing = await this.repository.findOne({ id: session.id.value });
    const orm = this.mapper.toOrm(session, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const events = session.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async findById(id: SessionId): Promise<Session | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCode(sessionCode: string): Promise<Session | null> {
    const orm = await this.repository.findOne({ sessionCode });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findActiveByParticipants(
    psicologoId: string,
    pacienteId: string,
  ): Promise<Session | null> {
    const orm = await this.repository.findOne(
      { psicologoId, pacienteId, active: true },
      { orderBy: { createdAt: 'DESC' } },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findStaleActive(before: Date): Promise<Session[]> {
    const list = await this.repository.find({
      active: true,
      createdAt: { $lt: before },
    });
    return list.map((orm) => this.mapper.toDomain(orm));
  }
}
