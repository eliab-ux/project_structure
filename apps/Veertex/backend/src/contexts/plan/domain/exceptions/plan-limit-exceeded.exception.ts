import { DomainException } from '@gitspread/domain-primitives';

/**
 * The plan's ceiling was reached. A 400 with a message the user can act on — it names the limit,
 * because "operação não permitida" would send them to support instead of to the upgrade page.
 */
export class PlanLimitExceededException extends DomainException {
  constructor(resource: 'empresas' | 'usuários', limit: number) {
    super(`Seu plano permite no máximo ${limit} ${resource}. Faça upgrade para incluir mais.`);
  }
}
