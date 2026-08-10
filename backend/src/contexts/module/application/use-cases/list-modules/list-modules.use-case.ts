import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../../plan/application/ports/output/plan-repository.port';
import { MODULE_CATALOG, dependentsOf } from '../../../domain/modules.catalog';
import {
  ACCOUNT_MODULE_REPOSITORY,
  AccountModuleRepositoryPort,
} from '../../ports/output/account-module-repository.port';
import { ModuleDto } from '../../dto/module.dto';

export class ListModulesQuery {
  constructor(public readonly accountId: string) {}
}

/**
 * O catálogo inteiro com o estado de cada módulo nesta conta.
 *
 * Devolve TODOS os módulos, inclusive os fora do plano, com `availableInPlan: false`. Esconder o que
 * não está contratado deixaria a tela silenciosa sobre o que existe — e é justamente ali que o
 * upgrade se explica sozinho.
 *
 * `blockingDependents` e `missingDependencies` vêm calculados para que a UI mostre o impedimento
 * ANTES do clique, em vez de o usuário descobrir por um 400 (01 §5: "toggles com dependências
 * visíveis").
 */
@Injectable()
export class ListModulesUseCase implements UseCase<ListModulesQuery, ModuleDto[]> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(ACCOUNT_MODULE_REPOSITORY)
    private readonly accountModules: AccountModuleRepositoryPort,
  ) {}

  async execute(query: ListModulesQuery): Promise<ModuleDto[]> {
    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const plan = await this.plans.findById(account.planId);
    const planModules = new Set(plan?.limits.modules ?? []);
    const activeCodes = new Set(await this.accountModules.listActiveCodes());

    return MODULE_CATALOG.map((definition) => {
      const active = definition.core || activeCodes.has(definition.code);

      return ModuleDto.from({
        definition,
        availableInPlan: definition.core || planModules.has(definition.code),
        active,
        // Só dependentes ATIVOS bloqueiam: um módulo desligado que depende deste não impede nada.
        blockingDependents: dependentsOf(definition.code).filter((code) => activeCodes.has(code)),
        missingDependencies: definition.dependsOn.filter((code) => !activeCodes.has(code)),
      });
    });
  }
}
