import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ScheduleRepositoryPort } from '../../../../contexts/schedule/application/ports/output/schedule-repository.port';
import { Schedule } from '../../../../contexts/schedule/domain/entities/schedule.entity';
import { ScheduleOrmEntity } from '../entities/schedule-orm.entity';
import { ScheduleMapper } from '../mappers/schedule.mapper';

@Injectable()
export class MikroOrmScheduleRepository implements ScheduleRepositoryPort {
  constructor(
    @InjectRepository(ScheduleOrmEntity)
    private readonly repository: EntityRepository<ScheduleOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ScheduleMapper,
  ) {}

  async save(schedule: Schedule): Promise<Schedule> {
    const existing = await this.repository.findOne({ id: schedule.id });
    const orm = this.mapper.toOrm(schedule, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findByUserId(userId: string): Promise<Schedule | null> {
    const orm = await this.repository.findOne({ userId });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findById(id: string): Promise<Schedule | null> {
    const orm = await this.repository.findOne({ id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findAllActive(): Promise<Schedule[]> {
    const rows = await this.repository.find({ isActive: true });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }
}
