import { DomainException, ValueObject } from '@veertex/domain-primitives';

export class InvalidPlanLimitsException extends DomainException {}

export interface PlanLimitsProps {
  /**
   * Module codes the plan allows (`CORE`, `VND`, `EST`, …). The plan is the CEILING; what the
   * account actually has switched on lives in `account_module` (F2). The final visibility is
   * `plano ∩ conta ∩ papel` (Visão Geral §2.1) and this is the first of the three.
   */
  modules: readonly string[];
}

/**
 * O teto comercial de um plano: **quais módulos ele permite**, e nada além disso.
 *
 * ⚠️ **Não há teto de empresas nem de usuários, e a ausência é deliberada** (decidido por Eliab em
 * 12/08/2026). O §3.1 do CORE diz que "plano define teto de MÓDULOS" e o §3.2 diz "N empresas por
 * conta" — nenhum dos dois menciona limite de empresa ou de usuário.
 *
 * Uma versão anterior deste VO tinha `maxCompanies` e `maxUsers`, e os planos semeados vinham com
 * `COMPLETO → 3 empresas / 20 usuários` e `ESSENCIAL → 1 / 5`. Ninguém pediu esses números: eram
 * **default silencioso**, que a regra da casa trata como defeito, não como conveniência. O efeito
 * seria uma conta recusando a quarta empresa em produção com uma mensagem que requisito nenhum
 * prevê — e ninguém saberia dizer se era regra ou bug.
 *
 * Se limitar empresa ou usuário por plano vier a fazer sentido comercial, nasce como decisão de
 * produto com preço atrelado, não como constante em arquivo de seed.
 *
 * jsonb e não colunas porque este é o lugar em que um valor sem forma fixa é a resposta certa: cada
 * módulo novo seria um ALTER TABLE numa tabela com uma linha por plano. Não é a situação do
 * `field_config` — nada aqui é atributo de entidade de negócio, e o schema pertence a este value
 * object, que o valida.
 */
export class PlanLimits extends ValueObject<PlanLimitsProps> {
  private constructor(props: PlanLimitsProps) {
    super(props);
  }

  /**
   * Chaves desconhecidas no `input` são IGNORADAS, e isso importa na transição: bancos existentes têm
   * `maxCompanies`/`maxUsers` gravados no jsonb das três linhas de plano. Elas ficam inertes — nada
   * as lê — em vez de exigir migration destrutiva sobre dado de configuração.
   */
  static create(input: { modules?: readonly string[] }): PlanLimits {
    const modules = Array.from(new Set(input.modules ?? [])).sort();

    // CORE is not optional (01_Veertex_Core §preâmbulo: "sempre ativo, não desativável"), so a plan
    // that omits it would describe a product that cannot log in. Added rather than rejected: the
    // seed should not have to restate a constant of the system.
    if (!modules.includes('CORE')) {
      modules.unshift('CORE');
    }

    if (modules.some((code) => typeof code !== 'string' || code.trim() === '')) {
      throw new InvalidPlanLimitsException(
        'Códigos de módulo do plano devem ser strings não vazias.',
      );
    }

    return new PlanLimits({ modules: Object.freeze(modules) });
  }

  get modules(): readonly string[] {
    return this.props.modules;
  }

  allowsModule(code: string): boolean {
    return this.props.modules.includes(code);
  }

  toJSON(): PlanLimitsProps {
    return { modules: [...this.props.modules] };
  }
}
