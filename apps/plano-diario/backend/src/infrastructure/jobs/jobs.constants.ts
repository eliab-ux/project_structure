export const DISPATCH_QUEUE = 'dispatch';
export const CATALOG_QUEUE = 'catalog';

export const JOB_DISPATCH_TICK = 'dispatch-tick';
export const JOB_DISPATCH_SEND = 'dispatch-send';
export const JOB_CATALOG_SYNC = 'catalog-sync';

export interface DispatchSendPayload {
  scheduleId: string;
  referenceDate: string;
  trigger: 'scheduled' | 'manual';
  /** Log existente do dia, para o retry/catch-up reaproveitar em vez de criar outro. */
  existingLogId?: string;
}

/**
 * Id determinístico do job de envio.
 *
 * **Nunca use `:` aqui.** O BullMQ recusa jobId customizado que contenha `:` — é o separador das
 * chaves do Redis — lançando "Custom Id cannot contain :". Como o `add()` acontecia dentro do
 * tick, essa exceção derrubava o tick INTEIRO a cada minuto e o envio automático nunca rodava,
 * enquanto o envio manual (que não passa pela fila) funcionava normalmente. Daí esta função
 * existir separada e testada: a restrição fica num lugar só, com o motivo escrito.
 *
 * O minuto entra no id para manter a idempotência onde ela importa — não enfileirar duas vezes no
 * MESMO minuto (restart, drift de relógio) — sem congelar o id por dia, o que faria o BullMQ
 * descartar em silêncio o catch-up de um dia que falhou.
 */
export function dispatchSendJobId(params: {
  scheduleId: string;
  referenceDate: string;
  /** `HHmm` do instante do tick. */
  minuteKey: string;
}): string {
  return ['send', params.scheduleId, params.referenceDate, params.minuteKey].join('_');
}

/**
 * `true` quando há Redis configurado. Sem Redis, o módulo de jobs não é registrado e a aplicação
 * sobe normalmente — o envio automático fica desligado, mas a API inteira continua funcionando.
 * Isso evita que um deploy quebre só porque o serviço Redis ainda não existe.
 */
export function isQueueEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DISPATCH_ENABLED === 'false') {
    return false;
  }
  return Boolean(env.REDIS_HOST && env.REDIS_HOST.trim().length > 0);
}
