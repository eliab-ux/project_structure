import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AccountModule } from '../../../domain/entities/account-module.entity';
import { MODULE_CATALOG } from '../../../domain/modules.catalog';

/**
 * Constrói as ativações iniciais de uma conta nova: **todo módulo que o plano permite já nasce
 * ligado**.
 *
 * A alternativa — nascer tudo desligado e o cliente ligar um a um — contraria o critério de aceite
 * §7.1 ("conta nova operável em menos de 5 min") e transformaria o primeiro acesso numa tela de
 * configuração. O toggle existe para DESLIGAR o que a conta não usa, não para montar o produto.
 *
 * Módulos `core` ficam de fora da tabela de propósito: eles estão sempre ativos por definição
 * (`resolveEffectiveModules`), e ter uma linha desativável para algo que não se desativa seria um
 * estado inalcançável esperando alguém tentar.
 *
 * Devolve entidades em vez de persistir: é chamado de dentro da transação do onboarding, que grava
 * conta, empresa, papéis, admin e módulos juntos ou nada.
 *
 * ⚠️ Quando o quiz de segmento do onboarding existir (onda do onboarding), é aqui que ele entra —
 * escolhendo um subconjunto do plano em vez de tudo.
 */
@Injectable()
export class SeedAccountModulesUseCase {
  build(params: { accountId: string; planModules: readonly string[] }): AccountModule[] {
    const allowed = new Set(params.planModules);

    return MODULE_CATALOG.filter(
      (definition) => !definition.core && allowed.has(definition.code),
    ).map((definition) =>
      AccountModule.activate({
        id: randomUUID(),
        accountId: params.accountId,
        moduleCode: definition.code,
      }),
    );
  }
}
