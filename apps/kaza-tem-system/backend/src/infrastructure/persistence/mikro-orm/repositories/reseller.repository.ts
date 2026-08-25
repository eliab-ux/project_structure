import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ResellerRepositoryPort } from '../../../../contexts/reseller/application/ports/output/reseller-repository.port';
import { Reseller } from '../../../../contexts/reseller/domain/entities/reseller.entity';
import { ResellerId } from '../../../../contexts/reseller/domain/value-objects/reseller-id.vo';
import { CPF } from '../../../../contexts/reseller/domain/value-objects/cpf.vo';
import { UniqueLink } from '../../../../contexts/reseller/domain/value-objects/unique-link.vo';
import { ResellerOrmEntity } from '../entities/reseller-orm.entity';
import { ResellerMapper } from '../mappers/reseller.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmResellerRepository implements ResellerRepositoryPort {
  constructor(
    @InjectRepository(ResellerOrmEntity)
    private readonly repository: EntityRepository<ResellerOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ResellerMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(reseller: Reseller): Promise<Reseller> {
    const ormEntity = this.mapper.toOrm(reseller);
    await this.em.persistAndFlush(ormEntity);

    const events = reseller.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: ResellerId): Promise<Reseller | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByUserId(userId: string): Promise<Reseller | null> {
    const orm = await this.repository.findOne({ userId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCPF(cpf: CPF): Promise<Reseller | null> {
    const orm = await this.repository.findOne({ cpf: cpf.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByUniqueLink(link: UniqueLink): Promise<Reseller | null> {
    const orm = await this.repository.findOne({ uniqueLink: link.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }
}
