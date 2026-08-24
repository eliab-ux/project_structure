import { DomainException } from '@gitspread/domain-primitives';

/** Emissão/consulta sem provedor configurado — fail closed LOUD, nunca um mock fingindo (regra 1). */
export class BillingProviderNotConfiguredException extends DomainException {
  constructor() {
    super(
      'Nenhum provedor de cobrança configurado. Configure o agregador (e credencial) em Cobrança → Configuração.',
    );
  }
}

export class ChargeNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Cobrança ${id.slice(0, 8)} não encontrada.`);
  }
}

export class InvalidChargeException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class DunningRuleInvalidException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
