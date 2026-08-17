import { DomainException } from '@gitspread/domain-primitives';

export class BankAccountNotFoundException extends DomainException {
  constructor() {
    super('Conta bancária não encontrada.');
  }
}

export class FinancialCategoryNotFoundException extends DomainException {
  constructor() {
    super('Categoria não encontrada.');
  }
}

export class CashEntryNotFoundException extends DomainException {
  constructor() {
    super('Lançamento não encontrado.');
  }
}

export class CashEntryAlreadyCancelledException extends DomainException {
  constructor() {
    super('Este lançamento já foi cancelado.');
  }
}

/**
 * A categoria não bate com o tipo do lançamento. Vira 400.
 *
 * Uma saída lançada na categoria "Hora de máquina" apareceria no DRE como despesa de uma conta de
 * receita — e o mês fecharia com um número que ninguém consegue explicar.
 */
export class CategoryDirectionMismatchException extends DomainException {
  constructor(type: string, direction: string) {
    super(
      `Um lançamento de ${type === 'in' ? 'entrada' : 'saída'} não pode usar uma categoria de ` +
        `${direction === 'in' ? 'entrada' : 'saída'}.`,
    );
  }
}

/**
 * Vira 400.
 *
 * Editar valor de lançamento efetivado é proibido (§4.15): **cancele e lance de novo**. A trilha
 * precisa mostrar as duas coisas — o valor errado e a correção —, e não um número que mudou sem
 * deixar rastro.
 */
export class CashEntryNotEditableException extends DomainException {
  constructor() {
    super(
      'Lançamento efetivado não pode ser editado. Cancele com o motivo e lance de novo — ' +
        'assim a trilha mostra o que aconteceu.',
    );
  }
}

/**
 * Não há conta bancária para receber a entrada automática do pagamento. Vira 400.
 *
 * Registrar o pagamento cria o lançamento de caixa no mesmo ato (§4.15), e todo lançamento aponta
 * para uma conta. Sem conta cadastrada não há onde o dinheiro cair.
 */
export class NoBankAccountForPaymentException extends DomainException {
  constructor(several: boolean) {
    super(
      several
        ? 'Há mais de uma conta bancária ativa. Informe em qual conta o pagamento entrou.'
        : 'Cadastre uma conta bancária antes de registrar pagamentos — a entrada de caixa precisa de uma conta.',
    );
  }
}
