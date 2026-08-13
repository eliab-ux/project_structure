import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { resolveEffectiveModules } from '../../../domain/modules.catalog';
import {
  ACCOUNT_MODULE_REPOSITORY,
  AccountModuleRepositoryPort,
} from '../../ports/output/account-module-repository.port';

export class GetEffectiveModulesQuery {
  constructor(public readonly accountId: string) {}
}

/**
 * `plano ∩ conta` — o conjunto de módulos que a conta pode usar agora.
 *
 * Chamado no login e no refresh, e o resultado vai para o token (`AuthTokenPayload.modules`). É a
 * consequência da decisão de arquitetura da F2: guards rodam ANTES da transação que carrega o
 * escopo do RLS, então um guard não consegue ler `account_modules` do banco — se conseguisse, esta
 * consulta viveria lá e não haveria defasagem nenhuma.
 *
 * O preço é a defasagem: ligar ou desligar um módulo só vale no próximo refresh (≤15 min). Para o
 * caso que mais incomoda — o administrador que acabou de mexer no toggle e não vê o menu mudar —
 * o `ToggleModule` devolve `requiresTokenRefresh`, e o frontend renova a sessão na hora.
 */
@Injectable()
export class GetEffectiveModulesUseCase implements UseCase<GetEffectiveModulesQuery, string[]> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(ACCOUNT_MODULE_REPOSITORY)
    private readonly accountModules: AccountModuleRepositoryPort,
  ) {}

  async execute(query: GetEffectiveModulesQuery): Promise<string[]> {
    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      // Sem conta não há interseção a calcular. Devolver vazio em vez de lançar: quem chama é o
      // login, que já tem o seu próprio tratamento para conta ausente e dá a mensagem certa.
      return resolveEffectiveModules({ planModules: [], activeAccountModules: [] });
    }

    const plan = await this.plans.findById(account.planId);
    const activeCodes = await this.accountModules.listActiveCodes();

    return resolveEffectiveModules({
      // Plano retirado do catálogo ainda vale para quem já o tem; se sumir de vez, a conta fica só
      // com os módulos core — degradação visível, nunca acesso indevido.
      planModules: plan?.limits.modules ?? [],
      activeAccountModules: activeCodes,
    });
  }
}
