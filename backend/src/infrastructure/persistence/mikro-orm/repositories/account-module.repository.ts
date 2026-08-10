import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { AccountModuleRepositoryPort } from '../../../../contexts/module/application/ports/output/account-module-repository.port';
import { AccountModule } from '../../../../contexts/module/domain/entities/account-module.entity';
import { AccountModuleOrmEntity } from '../entities/account-module-orm.entity';

@Injectable()
export class MikroOrmAccountModuleRepository implements AccountModuleRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async listAll(): Promise<AccountModule[]> {
    const rows = await this.em.find(AccountModuleOrmEntity, {}, { orderBy: { moduleCode: 'ASC' } });
    return rows.map((orm) => this.toDomain(orm));
  }

  async listActiveCodes(): Promise<string[]> {
    const rows = await this.em.find(
      AccountModuleOrmEntity,
      { active: true },
      { fields: ['moduleCode'], orderBy: { moduleCode: 'ASC' } },
    );
    return rows.map((row) => row.moduleCode);
  }

  async findByCode(moduleCode: string): Promise<AccountModule | null> {
    const orm = await this.em.findOne(AccountModuleOrmEntity, { moduleCode });
    return orm ? this.toDomain(orm) : null;
  }

  async save(accountModule: AccountModule): Promise<AccountModule> {
    const orm = await this.em.upsert(AccountModuleOrmEntity, this.toOrmData(accountModule));
    await this.em.flush();
    return this.toDomain(orm);
  }

  async saveAll(accountModules: AccountModule[]): Promise<AccountModule[]> {
    if (accountModules.length === 0) {
      return [];
    }
    const rows = await this.em.upsertMany(
      AccountModuleOrmEntity,
      accountModules.map((accountModule) => this.toOrmData(accountModule)),
    );
    await this.em.flush();
    return rows.map((orm) => this.toDomain(orm));
  }

  /** Inline: uma forma só, um consumidor só, sem conversão de domínio além desta. */
  private toDomain(orm: AccountModuleOrmEntity): AccountModule {
    return AccountModule.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      moduleCode: orm.moduleCode,
      active: orm.active,
      activatedAt: orm.activatedAt,
      deactivatedAt: orm.deactivatedAt,
      createdAt: orm.createdAt,
    });
  }

  private toOrmData(accountModule: AccountModule): Record<string, unknown> {
    return {
      id: accountModule.id,
      accountId: accountModule.accountId,
      moduleCode: accountModule.moduleCode,
      active: accountModule.active,
      activatedAt: accountModule.activatedAt,
      deactivatedAt: accountModule.deactivatedAt,
      createdAt: accountModule.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}
