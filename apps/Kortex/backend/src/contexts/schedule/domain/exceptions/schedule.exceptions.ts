import { DomainException } from '@gitspread/domain-primitives';

export class ScheduleEntryNotFoundException extends DomainException {
  constructor() {
    super('Compromisso não encontrado.');
  }
}

export class ReservationNotFoundException extends DomainException {
  constructor() {
    super('Reserva não encontrada.');
  }
}

/** Reserva fora de hora cheia ou com duração fracionada. Vira 400. */
export class UnalignedReservationException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/** Reserva fora das janelas, ou atravessando o intervalo. Vira 400. */
export class OutsideBusinessHoursException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Duas horas de máquina sobrepostas na mesma máquina. Vira 400.
 *
 * A mesma regra é constraint de exclusão no banco (`schedule_entry_no_machine_overlap`). A
 * validação aqui produz a mensagem que o Administrativo entende; a do banco é o que garante a
 * regra quando duas telas salvam ao mesmo tempo.
 */
export class MachineHourOverlapException extends DomainException {
  constructor() {
    super('Já existe hora de máquina reservada nesse intervalo para esta máquina.');
  }
}

/** Máquina inativa não aceita reserva nova, mas mantém o histórico (§4.2). */
export class InactiveMachineException extends DomainException {
  constructor() {
    super('Esta máquina está inativa e não aceita reserva nova.');
  }
}

/**
 * Remarcação com duração diferente da original. Vira 400.
 *
 * A remarcação não cobra nada de novo (§4.15): a reserva nova nasce paga com o dinheiro da
 * original. Mudar a duração mudaria o total de uma venda já paga, e o caixa deixaria de bater com o
 * que o cliente comprou.
 *
 * A mensagem **orienta o caminho**, e não é detalhe de redação: o caso real é o cliente que pagou
 * 2h, não veio e agora quer 3h. Dizer "cancele e faça uma reserva nova" obrigaria o Administrativo a
 * refazer a cobrança inteira sem saber o que fazer com o dinheiro que já entrou. O caminho é
 * remarcar as horas pagas e vender a diferença à parte: duas reservas, dois pagamentos, dois
 * lançamentos — rastreável, e sem inventar contas a receber parcial, que não existe no regime de
 * caixa.
 */
export class RescheduleDurationMismatchException extends DomainException {
  constructor(original: number, requested: number) {
    super(
      `A remarcação mantém as ${original}h já pagas (pedido: ${requested}h). Se o cliente precisa ` +
        'de mais tempo, remarque estas horas e crie uma reserva separada para o restante.',
    );
  }
}

/**
 * Transição de status não permitida pela máquina de estados (§4.11). Vira 400.
 *
 * A mensagem nomeia o estado atual porque quem a lê está operando a agenda, e a informação útil é
 * "esta reserva está em outro ponto do fluxo" — não "a operação falhou".
 */
export class InvalidReservationTransitionException extends DomainException {
  constructor(action: string, status: string) {
    const labels: Record<string, string> = {
      pre_reserved: 'pré-reservada, aguardando pagamento',
      confirmed: 'paga e confirmada',
      in_progress: 'em execução',
      completed: 'concluída',
      released: 'liberada para a fila de espera',
      no_show: 'marcada como não comparecimento',
      cancelled: 'cancelada',
    };
    super(`Não é possível ${action}: a reserva está ${labels[status] ?? status}.`);
  }
}
