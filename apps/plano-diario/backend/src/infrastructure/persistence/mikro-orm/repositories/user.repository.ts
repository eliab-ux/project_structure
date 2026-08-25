import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { UserRepositoryPort } from '../../../../contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class MikroOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: EntityRepository<UserOrmEntity>,
    // EntityRepository não tem persistAndFlush — persistência sai sempre pelo EntityManager.
    private readonly em: EntityManager,
    private readonly mapper: UserMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(user: User): Promise<User> {
    const existing = await this.repository.findOne({ id: user.id.value });
    const orm = this.mapper.toOrm(user, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    // Eventos publicados só APÓS a persistência bem-sucedida.
    const events = user.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async findById(id: UserId): Promise<User | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const orm = await this.repository.findOne({ email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async exists(email: Email): Promise<boolean> {
    return (await this.repository.count({ email: email.value })) > 0;
  }
}
