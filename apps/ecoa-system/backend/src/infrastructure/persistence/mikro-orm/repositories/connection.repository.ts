import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ConnectionRepositoryPort } from '../../../../contexts/connection/application/ports/output/connection-repository.port';
import { InstagramConnection } from '../../../../contexts/connection/domain/entities/instagram-connection.entity';
import { InstagramConnectionOrmEntity } from '../entities/instagram-connection-orm.entity';
import { InstagramConnectionMapper } from '../mappers/instagram-connection.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmConnectionRepository implements ConnectionRepositoryPort {
  constructor(
    @InjectRepository(InstagramConnectionOrmEntity)
    private readonly repository: EntityRepository<InstagramConnectionOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: InstagramConnectionMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async findByOwner(ownerId: string): Promise<InstagramConnection | null> {
    const orm = await this.repository.findOne({ ownerId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByIgUserId(igUserId: string): Promise<InstagramConnection | null> {
    const orm = await this.repository.findOne({ igUserId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAllConnected(): Promise<InstagramConnection[]> {
    const rows = await this.repository.find({ status: 'connected' });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async save(connection: InstagramConnection): Promise<InstagramConnection> {
    const existing = await this.repository.findOne({ id: connection.id.value });
    const orm = this.mapper.toOrm(connection, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const events = connection.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async delete(ownerId: string): Promise<void> {
    const orm = await this.repository.findOne({ ownerId });
    if (orm) {
      await this.em.removeAndFlush(orm);
    }
  }
}
