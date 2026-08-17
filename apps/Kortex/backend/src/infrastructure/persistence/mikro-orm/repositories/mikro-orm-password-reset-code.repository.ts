import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { PasswordResetCodeRepositoryPort } from '../../../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';
import { PasswordResetCodeMapper } from '../mappers/password-reset-code.mapper';

/**
 * As consultas são por `user_id`, e não por conta, e isso não fura o isolamento: o fluxo de
 * recuperação começa anônimo — quem o dispara não tem token, logo não tem conta. O usuário é
 * localizado pelo e-mail (global e único), e o `user_id` resultante já é o escopo mais estreito
 * possível, mais estreito que a conta inteira. A coluna `account_id` continua gravada para o
 * relatório e para o cascade.
 */
@Injectable()
export class MikroOrmPasswordResetCodeRepository implements PasswordResetCodeRepositoryPort {
  constructor(
    @InjectRepository(PasswordResetCodeOrmEntity)
    private readonly repo: EntityRepository<PasswordResetCodeOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PasswordResetCodeMapper,
  ) {}

  async findLiveByUser(userId: UserId): Promise<PasswordResetCode | null> {
    // Casa com o índice parcial `password_reset_code_live_index` (user_id, created_at desc)
    // where used_at is null.
    const orm = await this.repo.findOne(
      { userId: userId.value, usedAt: null },
      { orderBy: { createdAt: 'DESC' } },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async countSentSince(userId: UserId, since: Date): Promise<number> {
    // Conta ENVIOS (`sentAt`), não criações: falha de infraestrutura no WhatsApp não pode consumir
    // a cota de quem nunca recebeu a mensagem.
    return this.repo.count({ userId: userId.value, sentAt: { $gte: since } });
  }

  async save(code: PasswordResetCode): Promise<PasswordResetCode> {
    const existing = await this.repo.findOne({ id: code.id.value });
    const orm = this.mapper.toOrm(code, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
