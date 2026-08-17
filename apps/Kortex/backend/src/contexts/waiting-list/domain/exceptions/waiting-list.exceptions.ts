import { DomainException } from '@gitspread/domain-primitives';

export class WaitingListEntryNotFoundException extends DomainException {
  constructor() {
    super('Entrada da fila de espera não encontrada.');
  }
}

export class SlotNoticeNotFoundException extends DomainException {
  constructor() {
    super('Aviso não encontrado.');
  }
}

/**
 * Transição inválida da fila. Vira 400.
 *
 * A máquina de estados é curta de propósito — `waiting → offered → converted`, com `dropped` como
 * saída — e a mensagem diz o estado atual porque quem a lê é o Administrativo operando a fila, e
 * a informação útil é "esta entrada está em outro ponto do fluxo".
 */
export class InvalidWaitingListTransitionException extends DomainException {
  constructor(action: string, status: string) {
    const labels: Record<string, string> = {
      waiting: 'esperando',
      offered: 'com vaga já oferecida',
      converted: 'já convertida em reserva',
      dropped: 'removida da fila',
    };
    super(`Não é possível ${action}: a entrada está ${labels[status] ?? status}.`);
  }
}
