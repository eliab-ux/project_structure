import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
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
import { AccountModule } from '../../../domain/entities/account-module.entity';
import { dependentsOf, findModule } from '../../../domain/modules.catalog';
import {
  CoreModuleNotToggleableException,
  ModuleDependencyMissingException,
  ModuleInUseByDependentsException,
  ModuleNotInPlanException,
  UnknownModuleException,
} from '../../../domain/exceptions/module-exceptions';
import {
  ACCOUNT_MODULE_REPOSITORY,
  AccountModuleRepositoryPort,
} from '../../ports/output/account-module-repository.port';

export class ToggleModuleCommand {
  constructor(
    public readonly accountId: string,
    public readonly moduleCode: string,
    public readonly active: boolean,
  ) {}
}

export interface ToggleModuleResult {
  moduleCode: string;
  active: boolean;
  /**
   * Sempre `true`. Os módulos efetivos viajam no token, então quem acabou de mexer no toggle
   * continuaria vendo o menu antigo até o próximo refresh. O frontend usa este campo para renovar a
   * sessão imediatamente — é a compensação combinada para a defasagem da Opção A.
   */
  requiresTokenRefresh: boolean;
}

/**
 * Liga ou desliga um módulo da conta, validando plano e dependências.
 *
 * **Desativar nunca apaga nada** (01_Veertex_Core §3.7). A linha permanece, os dados do módulo
 * permanecem, e reativar devolve tudo — o que só é verdade porque a desativação é um flag e não uma
 * limpeza.
 */
@Injectable()
export class ToggleModuleUseCase implements UseCase<ToggleModuleCommand, ToggleModuleResult> {
  private readonly logger = new Logger(ToggleModuleUseCase.name);

  constructor(
    @Inject(ACCOUNT_MODULE_REPOSITORY)
    private readonly accountModules: AccountModuleRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ToggleModuleCommand): Promise<ToggleModuleResult> {
    const definition = findModule(command.moduleCode);
    if (!definition) {
      throw new UnknownModuleException(command.moduleCode);
    }
    if (definition.core) {
      // Vale para os dois sentidos: o CORE não se liga nem se desliga, ele simplesmente é.
      throw new CoreModuleNotToggleableException(definition.code);
    }

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const activeCodes = new Set(await this.accountModules.listActiveCodes());

    if (command.active) {
      const plan = await this.plans.findById(account.planId);
      // O teto do plano é checado só na ATIVAÇÃO. Desativar um módulo fora do plano precisa
      // continuar possível — é exatamente o estado em que uma conta fica após um downgrade.
      if (!plan?.limits.allowsModule(definition.code)) {
        throw new ModuleNotInPlanException(definition.code);
      }

      const missing = definition.dependsOn.filter((code) => !activeCodes.has(code));
      if (missing.length > 0) {
        throw new ModuleDependencyMissingException(definition.code, missing);
      }
    } else {
      // DECIDIDO (Eliab, 10/08/2026 — INSTRUCOES §B4.2): BLOQUEAR, nomeando os dependentes ativos.
      //
      // O 01_Veertex_Core §3.7 manda validar dependência na ATIVAÇÃO (COB exige FIN ativo) e é
      // silencioso sobre o caminho inverso. As alternativas descartadas:
      //
      //   CASCATA   — desativaria FIN e COB juntos. Conveniente, e capaz de desligar num clique um
      //               módulo que o cliente estava usando sem ter pedido nada sobre ele.
      //   PERMITIR  — deixaria o COB ativo e quebrado.
      //
      // Bloquear é o único que não causa perda de acesso inesperada. A mensagem nomeia os
      // dependentes porque "não é possível desativar" sozinho manda o usuário adivinhar qual dos
      // módulos ativos está no caminho — e a `ListModules` já devolve `blockingDependents` para a
      // UI mostrar o impedimento antes do clique.
      const dependents = dependentsOf(definition.code).filter((code) => activeCodes.has(code));
      if (dependents.length > 0) {
        throw new ModuleInUseByDependentsException(definition.code, dependents);
      }
    }

    const existing = await this.accountModules.findByCode(definition.code);
    const accountModule =
      existing ??
      AccountModule.activate({
        id: randomUUID(),
        accountId: command.accountId,
        moduleCode: definition.code,
      });

    if (command.active) {
      accountModule.turnOn();
    } else {
      accountModule.turnOff();
    }

    return this.uow.execute(async () => {
      const saved = await this.accountModules.save(accountModule);

      this.logger.log('Módulo alternado', {
        accountId: command.accountId,
        moduleCode: saved.moduleCode,
        active: saved.active,
      });

      return {
        moduleCode: saved.moduleCode,
        active: saved.active,
        requiresTokenRefresh: true,
      };
    });
  }
}
