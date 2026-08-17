import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { UserRepositoryPort } from '../../../../contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class MikroOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: EntityRepository<UserOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: UserMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<User[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      { orderBy: { isActive: 'DESC', name: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: UserId): Promise<User | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  /**
   * ÚNICA consulta do sistema sem filtro de conta — e proposital.
   *
   * No login o usuário informa e-mail e senha, e é esta consulta que descobre a qual conta ele
   * pertence: não existe `accountId` para filtrar antes de saber quem ele é. O índice único
   * global em `email` é o que garante que a resposta seja no máximo um usuário.
   *
   * O verificador `check:tenant-scope` reconhece esta exceção pelo nome do método. Nenhuma outra
   * consulta deve seguir este exemplo.
   */
  async findByEmailGlobally(email: Email): Promise<User | null> {
    const orm = await this.repo.findOne({ email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(user: User): Promise<User> {
    const existing = await this.repo.findOne({
      accountId: user.accountId.value,
      id: user.id.value,
    });
    const orm = this.mapper.toOrm(user, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }
}
