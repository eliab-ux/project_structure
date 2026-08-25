import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UnitOfWorkPort } from '../ports/unit-of-work.port';

@Injectable()
export class MikroOrmUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly em: EntityManager) {}

  async execute<T>(work: () => Promise<T>): Promise<T> {
    return this.em.transactional(async () => work());
  }
}
