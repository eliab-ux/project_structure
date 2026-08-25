import { Injectable } from '@nestjs/common';
import { Visit } from '@contexts/analytics/domain/entities/visit.entity';
import { VisitId } from '@contexts/analytics/domain/value-objects/visit-id.vo';
import { VisitOrmEntity } from '../entities/visit-orm.entity';

@Injectable()
export class VisitMapper {
  toDomain(orm: VisitOrmEntity): Visit {
    return Visit.reconstitute({
      id: VisitId.from(orm.id),
      resellerId: orm.resellerId,
      visitorId: orm.visitorId ?? null,
      ipAddress: orm.ipAddress ?? null,
      userAgent: orm.userAgent ?? null,
      referrer: orm.referrer ?? null,
      pageUrl: orm.pageUrl ?? null,
      createdAt: orm.createdAt,
    });
  }

  toOrm(domain: Visit): VisitOrmEntity {
    const orm = new VisitOrmEntity();
    orm.id = domain.id.value;
    orm.resellerId = domain.resellerId;
    orm.visitorId = domain.visitorId ?? undefined;
    orm.ipAddress = domain.ipAddress ?? undefined;
    orm.userAgent = domain.userAgent ?? undefined;
    orm.referrer = domain.referrer ?? undefined;
    orm.pageUrl = domain.pageUrl ?? undefined;
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
