import { DomainException } from '@gitspread/domain-primitives';

/** Apurar Modelo A para um vendedor que não é Modelo A (§2 do 02A). Mensagem acionável. */
export class CommissionModelMismatchException extends DomainException {
  constructor(model: string) {
    super(
      `Apuração do Modelo A indisponível: o vendedor está configurado como "${model}". ` +
        'Ajuste o modelo de comissão do usuário para "a".',
    );
  }
}

/** Vendedor não encontrado na apuração de comissão. */
export class CommissionSalesRepNotFoundException extends DomainException {
  constructor() {
    super('Vendedor não encontrado.');
  }
}

/** Faixas malformadas (vazias, limiar repetido, comissão decrescente) — erro de digitação, recusado. */
export class InvalidCommissionTiersException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
