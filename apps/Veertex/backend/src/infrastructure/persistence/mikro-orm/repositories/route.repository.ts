import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RouteRepositoryPort } from '../../../../contexts/route/application/ports/output/route-repository.port';
import { Route } from '../../../../contexts/route/domain/entities/route.entity';
import { RouteOrmEntity } from '../entities/route-orm.entity';

@Injectable()
export class MikroOrmRouteRepository implements RouteRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: RouteOrmEntity): Route {
    return Route.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      code: orm.code,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<Route | null> {
    const orm = await this.em.findOne(RouteOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async list(includeInactive: boolean): Promise<Route[]> {
    const rows = await this.em.find(
      RouteOrmEntity,
      { ...(includeInactive ? {} : { active: true }) },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async save(route: Route): Promise<Route> {
    const existing = await this.em.findOne(RouteOrmEntity, { id: route.id });
    if (existing) {
      existing.name = route.name;
      existing.code = route.code;
      existing.active = route.active;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(RouteOrmEntity, {
      id: route.id,
      accountId: route.accountId,
      name: route.name,
      code: route.code,
      active: route.active,
      createdAt: route.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
