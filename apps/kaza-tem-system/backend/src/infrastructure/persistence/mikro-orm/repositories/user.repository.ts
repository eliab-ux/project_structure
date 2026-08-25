import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { UserRepositoryPort } from '../../../../contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { UserMapper } from '../mappers/user.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: EntityRepository<UserOrmEntity>,
    private readonly mapper: UserMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(user: User): Promise<User> {
    const existing = await this.repository.findOne({ id: user.id.value });

    let ormEntity: UserOrmEntity;

    if (existing) {
      // Update existing
      ormEntity = this.mapper.toOrmPartial(user, existing);
    } else {
      // Create new
      ormEntity = this.mapper.toOrm(user);
    }

    await this.repository.getEntityManager().persistAndFlush(ormEntity);

    // Publish domain events after successful persistence
    const events = user.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: UserId): Promise<User | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const orm = await this.repository.findOne({ email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAll(): Promise<User[]> {
    const ormEntities = await this.repository.findAll();
    return ormEntities.map((orm) => this.mapper.toDomain(orm));
  }

  async exists(email: Email): Promise<boolean> {
    const count = await this.repository.count({ email: email.value });
    return count > 0;
  }

  async delete(id: UserId): Promise<void> {
    await this.repository.nativeDelete({ id: id.value });
  }
}
