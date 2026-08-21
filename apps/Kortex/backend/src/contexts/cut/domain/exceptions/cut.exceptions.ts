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
 * Pediram para apontar uma matriz que este pedido não declara. Vira 400.
 *
 * O apontamento executa uma matriz declarada e só isso (§4.10). Um id que não está no pedido é
 * ou tela desatualizada, ou reserva trocada — e nos dois casos a resposta certa é recusar, não
 * criar uma matriz que ninguém pediu.
 */
export class MatrizNotDeclaredException extends DomainException {
  constructor() {
    super('Esta matriz não faz parte do pedido desta reserva.');
  }
}

/** A matriz declarada já tem apontamento. Vira 400 — o índice único diria o mesmo, em 500. */
export class MatrizAlreadyPointedException extends DomainException {
  constructor(sequence: number) {
    super(`A matriz ${sequence} já foi apontada. Cada matriz do pedido é apontada uma única vez.`);
  }
}

/**
 * Todas as matrizes declaradas já foram apontadas. Vira 400.
 *
 * É a regra que o dono pediu em uma frase: **só a quantidade de matriz que tem no pedido**. Se o
 * trabalho na mesa é maior do que o pedido descreve, quem corrige é o pedido — não o cronômetro.
 */
export class AllMatrizesPointedException extends DomainException {
  constructor(declared: number) {
    super(
      `Este pedido declara ${declared} ${declared === 1 ? 'matriz' : 'matrizes'} e ` +
        `${declared === 1 ? 'ela já foi apontada' : 'todas já foram apontadas'}. ` +
        'Para apontar outra, inclua a matriz no pedido.',
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
