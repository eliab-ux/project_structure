import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { VisitRepositoryPort } from '@contexts/analytics/application/ports/output/visit-repository.port';
import { Visit } from '@contexts/analytics/domain/entities/visit.entity';
import { VisitMapper } from '../mappers/visit.mapper';

@Injectable()
export class MikroOrmVisitRepository implements VisitRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: VisitMapper,
  ) {}

  async save(visit: Visit): Promise<Visit> {
    const orm = this.mapper.toOrm(visit);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async countByResellerId(resellerId: string): Promise<number> {
    const rows = await this.em
      .getConnection()
      .execute('SELECT COUNT(*) AS count FROM visits WHERE reseller_id = $1', [resellerId]);
    return Number(rows[0]?.count ?? 0);
  }

  async countByResellerIdSince(resellerId: string, since: Date): Promise<number> {
    const rows = await this.em
      .getConnection()
      .execute('SELECT COUNT(*) AS count FROM visits WHERE reseller_id = $1 AND created_at >= $2', [
        resellerId,
        since.toISOString(),
      ]);
    return Number(rows[0]?.count ?? 0);
  }
}
