import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { WhatsappInstanceRepositoryPort } from '../../../../contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { WhatsappInstance } from '../../../../contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';
import { WhatsappInstanceOrmEntity } from '../entities/whatsapp-instance-orm.entity';
import { WhatsappInstanceMapper } from '../mappers/whatsapp-instance.mapper';

@Injectable()
export class MikroOrmWhatsappInstanceRepository implements WhatsappInstanceRepositoryPort {
  constructor(
    @InjectRepository(WhatsappInstanceOrmEntity)
    private readonly repository: EntityRepository<WhatsappInstanceOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: WhatsappInstanceMapper,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(instance: WhatsappInstance): Promise<WhatsappInstance> {
    const existing = await this.repository.findOne({ id: instance.id });
    const orm = this.mapper.toOrm(instance, existing ?? undefined);
    await this.em.persistAndFlush(orm);

    const events = instance.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }
    return this.mapper.toDomain(orm);
  }

  async findByUserId(userId: string): Promise<WhatsappInstance | null> {
    const orm = await this.repository.findOne({ userId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByInstanceName(instanceName: string): Promise<WhatsappInstance | null> {
    const orm = await this.repository.findOne({ instanceName });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async delete(instance: WhatsappInstance): Promise<void> {
    const orm = await this.repository.findOne({ id: instance.id });
    if (orm) {
      await this.em.removeAndFlush(orm);
    }
  }
}
