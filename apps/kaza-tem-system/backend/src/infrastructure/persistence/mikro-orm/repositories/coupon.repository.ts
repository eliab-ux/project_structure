import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository, FilterQuery, QueryOrder } from '@mikro-orm/core';
import {
  CouponRepositoryPort,
} from '../../../../contexts/coupon/application/ports/output/coupon-repository.port';
import { Coupon } from '../../../../contexts/coupon/domain/entities/coupon.entity';
import { CouponId } from '../../../../contexts/coupon/domain/value-objects/coupon-id.vo';
import { CouponCode } from '../../../../contexts/coupon/domain/value-objects/coupon-code.vo';
import { CouponOrmEntity } from '../entities/coupon-orm.entity';
import { CouponMapper } from '../mappers/coupon.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';

@Injectable()
export class MikroOrmCouponRepository implements CouponRepositoryPort {
  constructor(
    @InjectRepository(CouponOrmEntity)
    private readonly repository: EntityRepository<CouponOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: CouponMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(coupon: Coupon): Promise<Coupon> {
    const existing = await this.repository.findOne({ id: coupon.id.value });

    const ormEntity = existing
      ? this.mapper.toOrmPartial(coupon, existing)
      : this.mapper.toOrm(coupon);

    await this.em.persistAndFlush(ormEntity);

    const events = coupon.pullDomainEvents();
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
    }

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: CouponId): Promise<Coupon | null> {
    const orm = await this.repository.findOne({ id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCode(code: CouponCode): Promise<Coupon | null> {
    const orm = await this.repository.findOne({ code: code.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAll(filter?: { resellerId?: string | null; isActive?: boolean }): Promise<Coupon[]> {
    const where: FilterQuery<CouponOrmEntity> = {};
    if (filter?.resellerId !== undefined) {
      where.resellerId = filter.resellerId;
    }
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const coupons = await this.repository.find(where, {
      orderBy: { createdAt: QueryOrder.DESC },
    });

    return coupons.map((orm) => this.mapper.toDomain(orm));
  }
}
