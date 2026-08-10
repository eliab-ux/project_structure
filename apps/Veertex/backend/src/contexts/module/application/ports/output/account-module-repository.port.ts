import { AccountModule } from '../../../domain/entities/account-module.entity';

export const ACCOUNT_MODULE_REPOSITORY = Symbol('ACCOUNT_MODULE_REPOSITORY');

export interface AccountModuleRepositoryPort {
  /** Todas as linhas da conta, ativas ou não — a tela de módulos mostra os dois estados. */
  listAll(): Promise<AccountModule[]>;

  /** Só os códigos ativos. É o que alimenta o cálculo de `plano ∩ conta` no login/refresh. */
  listActiveCodes(): Promise<string[]>;

  findByCode(moduleCode: string): Promise<AccountModule | null>;

  save(accountModule: AccountModule): Promise<AccountModule>;

  saveAll(accountModules: AccountModule[]): Promise<AccountModule[]>;
}
