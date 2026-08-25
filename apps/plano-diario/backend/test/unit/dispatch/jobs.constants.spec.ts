import {
  dispatchSendJobId,
  isQueueEnabled,
  JOB_CATALOG_SYNC,
  JOB_DISPATCH_SEND,
  JOB_DISPATCH_TICK,
} from '../../../src/infrastructure/jobs/jobs.constants';

const BASE = {
  scheduleId: 'd3637abe-5b58-4e5d-b838-d23317aaad18',
  referenceDate: '2026-07-29',
  minuteKey: '1810',
};

describe('dispatchSendJobId', () => {
  it('NUNCA contém ":" — o BullMQ recusa jobId com dois-pontos', () => {
    // O bug real: a validação do BullMQ é
    //   if (jobId.includes(':') && jobId.split(':').length !== 3) throw 'Custom Id cannot contain :'
    // Ela tolera `:` só quando o id tem exatamente 3 partes — compatibilidade temporária com ids
    // antigos de repeatable, com um TODO no próprio código deles para remover. O id original
    // (`send:<id>:<data>`) passava por acaso, com 3 partes; acrescentar o minuto fez 4 e passou a
    // estourar DENTRO do tick, derrubando o tick inteiro a cada minuto.
    // Não depender dessa contagem é o ponto: sem `:`, a regra deixa de existir para nós.
    expect(dispatchSendJobId(BASE)).not.toContain(':');
  });

  it('nenhum nome de job usa ":" (mesma restrição do BullMQ)', () => {
    for (const name of [JOB_DISPATCH_TICK, JOB_DISPATCH_SEND, JOB_CATALOG_SYNC]) {
      expect(name).not.toContain(':');
    }
  });

  it('é determinístico dentro do mesmo minuto (não enfileira duas vezes)', () => {
    expect(dispatchSendJobId(BASE)).toBe(dispatchSendJobId({ ...BASE }));
  });

  it('muda no minuto seguinte, para o catch-up conseguir tentar de novo', () => {
    // Sem o minuto no id, um dia que falhou ficava falhado para sempre: o BullMQ descartaria
    // silenciosamente qualquer nova tentativa por id repetido.
    expect(dispatchSendJobId({ ...BASE, minuteKey: '1811' })).not.toBe(dispatchSendJobId(BASE));
  });

  it('separa agendamentos e datas diferentes', () => {
    expect(dispatchSendJobId({ ...BASE, scheduleId: 'outro-id' })).not.toBe(
      dispatchSendJobId(BASE),
    );
    expect(dispatchSendJobId({ ...BASE, referenceDate: '2026-07-30' })).not.toBe(
      dispatchSendJobId(BASE),
    );
  });
});

describe('isQueueEnabled', () => {
  it('sem REDIS_HOST o módulo de jobs não entra (a API sobe sem envio automático)', () => {
    expect(isQueueEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isQueueEnabled({ REDIS_HOST: '   ' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('DISPATCH_ENABLED=false desliga mesmo com Redis configurado', () => {
    expect(
      isQueueEnabled({ REDIS_HOST: 'redis', DISPATCH_ENABLED: 'false' } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('com REDIS_HOST e sem DISPATCH_ENABLED, o padrão é ligado', () => {
    expect(isQueueEnabled({ REDIS_HOST: 'redis' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
