import { DomainException } from '@gitspread/domain-primitives';

export class CutNotFoundException extends DomainException {
  constructor() {
    super('Matriz não encontrada.');
  }
}

export class CutAlreadyEndedException extends DomainException {
  constructor() {
    super('Esta matriz já foi encerrada.');
  }
}

export class CutNotEndedException extends DomainException {
  constructor() {
    super('Esta matriz ainda está em andamento.');
  }
}

/**
 * Já existe uma matriz rodando nesta reserva. Vira 400.
 *
 * Uma reserva tem N matrizes, mas **uma de cada vez**: são feitas em sequência na mesma máquina.
 * Duas rodando ao mesmo tempo significaria que alguém deu start esquecendo o stop — e o tempo da
 * primeira ficaria contando para sempre.
 */
export class CutAlreadyRunningException extends DomainException {
  constructor(sequence: number) {
    super(
      `A matriz ${sequence} desta reserva ainda está em andamento. Encerre-a antes de começar outra.`,
    );
  }
}

/**
 * Vira 403.
 *
 * Só existe matriz em reserva `confirmed` ou `in_progress` (§4.10) — e o motivo é a regra 2.4:
 * reserva não paga **não existe** para o Modelista. Dar start numa pré-reserva seria cortar
 * tecido de um serviço que ninguém comprou.
 */
export class ForbiddenCutOnUnpaidReservationException extends DomainException {
  constructor() {
    super(
      'Esta reserva não está paga. Sem pagamento registrado, o corte não pode começar — ' +
        'fale com o Administrativo.',
    );
  }
}

/** Depois de `completed`, a matriz não é mais editável pelo Modelista (DoD da Fase 5). Vira 403. */
export class ForbiddenCompletedReservationChangeException extends DomainException {
  constructor() {
    super('Esta reserva já foi concluída e as matrizes não podem mais ser alteradas.');
  }
}
