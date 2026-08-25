import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { PasswordResetCodeRepositoryPort } from '../../../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';
import { PasswordResetCodeMapper } from '../mappers/password-reset-code.mapper';

@Injectable()
export class MikroOrmPasswordResetCodeRepository implements PasswordResetCodeRepositoryPort {
  constructor(
    @InjectRepository(PasswordResetCodeOrmEntity)
    private readonly repository: EntityRepository<PasswordResetCodeOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PasswordResetCodeMapper,
  ) {}

  async save(code: PasswordResetCode): Promise<PasswordResetCode> {
    const existing = await this.repository.findOne({ id: code.id });
    const orm = this.mapper.toOrm(code, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async findLatestUnused(userId: string): Promise<PasswordResetCode | null> {
    const orm = await this.repository.findOne(
      { userId, usedAt: null },
      { orderBy: { createdAt: 'desc' } },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async countSentSince(userId: string, since: Date): Promise<number> {
    // `sentAt` nulo (mensagem que não saiu) não entra na conta — é o ponto do método.
    return this.repository.count({ userId, sentAt: { $gte: since } });
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    // UPDATE direto: são no máximo alguns registros e não há regra de domínio a aplicar em cada um.
    await this.em.nativeUpdate(
      PasswordResetCodeOrmEntity,
      { userId, usedAt: null },
      { usedAt: now },
    );
  }
}
