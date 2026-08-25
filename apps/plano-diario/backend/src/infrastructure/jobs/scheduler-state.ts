/**
 * Últimos sinais de vida do agendador, para o `/api/health` responder "ele está rodando?".
 *
 * É estado de módulo, não um provider injetável, por um motivo prático: o `JobsModule` só é
 * carregado quando há Redis configurado, então um provider morreria justamente no cenário que
 * mais precisa ser diagnosticado — o de o agendador não existir. Assim o health lê o estado
 * independentemente do módulo ter subido.
 *
 * Nada aqui é sensível: quantidade de execuções e horário do último tick. Sem id, sem telefone,
 * sem conteúdo de mensagem.
 */
/**
 * Em que etapa o tick quebrou. Só o NOME da etapa, nunca a mensagem da exceção — o health é
 * público, e mensagem de erro carrega caminho de arquivo, SQL e nome de coluna.
 *
 * `plan`    = decidir quem deve receber (carregar agendamentos, comparar horários);
 * `enqueue` = enfileirar os envios decididos;
 * `send`    = o job de envio em si.
 */
export type SchedulerStage = 'plan' | 'enqueue' | 'send';

interface SchedulerState {
  ticks: number;
  lastTickAt: string | null;
  /** Quantos envios o último tick considerou devidos. */
  lastDue: number;
  /** Decisões concluídas com sucesso — separado de `ticks`, que exige o enfileiramento também. */
  plans: number;
  lastErrorAt: string | null;
  lastErrorStage: SchedulerStage | null;
}

const state: SchedulerState = {
  ticks: 0,
  lastTickAt: null,
  lastDue: 0,
  plans: 0,
  lastErrorAt: null,
  lastErrorStage: null,
};

/** A decisão terminou. Registrado ANTES do enfileiramento, para separar as duas falhas. */
export function recordPlan(due: number): void {
  state.plans += 1;
  state.lastDue = due;
}

export function recordTick(due: number, at: Date = new Date()): void {
  state.ticks += 1;
  state.lastTickAt = at.toISOString();
  state.lastDue = due;
}

export function recordTickError(stage: SchedulerStage, at: Date = new Date()): void {
  state.lastErrorAt = at.toISOString();
  state.lastErrorStage = stage;
}

export function readSchedulerState(): SchedulerState {
  return { ...state };
}
