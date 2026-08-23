import { valorPorExtenso } from '../../src/contexts/route/domain/valor-por-extenso';
import { PromissoryNote } from '../../src/contexts/route/domain/entities/promissory-note.entity';
import { OrderEvidence } from '../../src/contexts/route/domain/entities/order-evidence.entity';
import {
  RegisterOrderEvidenceCommand,
  RegisterOrderEvidenceUseCase,
} from '../../src/contexts/route/application/use-cases/register-order-evidence/register-order-evidence.use-case';
import {
  ChangeOrderGpsCommand,
  ChangeOrderGpsUseCase,
} from '../../src/contexts/route/application/use-cases/change-order-gps/change-order-gps.use-case';
import { OrderEvidenceRepositoryPort } from '../../src/contexts/route/application/ports/output/order-evidence-repository.port';
import { EvidenceStoragePort } from '../../src/contexts/route/application/ports/output/evidence-storage.port';
import {
  GpsAlreadyCapturedException,
  GpsNotCapturedException,
} from '../../src/contexts/route/domain/exceptions/route-exceptions';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const PEDIDO = '22222222-2222-4222-8222-222222222222';
const OPERADOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function evidencesFalso() {
  const saved: OrderEvidence[] = [];
  const repo: OrderEvidenceRepositoryPort = {
    listByOrder: async (orderId) => saved.filter((e) => e.orderId === orderId),
    findCurrentGps: async (orderId) => {
      const gps = saved.filter((e) => e.orderId === orderId && e.type === 'gps');
      return gps.length > 0 ? gps[gps.length - 1] : null;
    },
    save: async (e) => {
      saved.push(e);
      return e;
    },
  };
  return { repo, saved };
}

const storageFalso: EvidenceStoragePort = {
  store: async (p) => `evidence/${p.accountId}/${p.orderId}/${p.kind}-x`,
};

describe('Valor por extenso (§3.1 do 04) — o que a promissória imprime', () => {
  const casos: [number, string][] = [
    [3692.91, 'três mil, seiscentos e noventa e dois reais e noventa e um centavos'],
    [3686.47, 'três mil, seiscentos e oitenta e seis reais e quarenta e sete centavos'],
    [100, 'cem reais'],
    [1, 'um real'],
    [0.01, 'um centavo'],
    [1000, 'mil reais'],
    [1500.5, 'mil e quinhentos reais e cinquenta centavos'],
    [1000000, 'um milhão de reais'],
    [0, 'zero real'],
  ];
  it.each(casos)('%p → "%s"', (valor, esperado) => {
    expect(valorPorExtenso(valor as number)).toBe(esperado);
  });
});

describe('PromissoryNote — 1 por pedido, sobre o total, com extenso', () => {
  it('gera com snapshot da devedora e valor por extenso', () => {
    const note = PromissoryNote.create({
      accountId: CONTA,
      orderId: PEDIDO,
      amount: 3692.91,
      debtorName: 'Maria da Silva',
      debtorDocument: '12345678901',
      dueDate: new Date('2026-10-22T00:00:00Z'),
    });
    expect(note.amount).toBe(3692.91);
    expect(note.amountInWords).toContain('três mil');
    expect(note.debtorName).toBe('Maria da Silva');
  });
});

describe('GPS — imutável; alteração só por ação explícita auditada (aceite 2 do 04)', () => {
  it('captura na abertura; recapturar é RECUSADO', async () => {
    const { repo } = evidencesFalso();
    const uc = new RegisterOrderEvidenceUseCase(repo, storageFalso, uowFalso);
    await uc.execute(
      new RegisterOrderEvidenceCommand(CONTA, {
        orderId: PEDIDO,
        type: 'gps',
        latitude: -16.68,
        longitude: -49.25,
      }),
    );
    await expect(
      uc.execute(
        new RegisterOrderEvidenceCommand(CONTA, {
          orderId: PEDIDO,
          type: 'gps',
          latitude: -1,
          longitude: -1,
        }),
      ),
    ).rejects.toThrow(GpsAlreadyCapturedException);
  });

  it('ChangeOrderGps preserva o anterior na cadeia, com quem/motivo (auditado)', async () => {
    const { repo, saved } = evidencesFalso();
    const register = new RegisterOrderEvidenceUseCase(repo, storageFalso, uowFalso);
    const change = new ChangeOrderGpsUseCase(repo, uowFalso);

    await register.execute(
      new RegisterOrderEvidenceCommand(CONTA, {
        orderId: PEDIDO,
        type: 'gps',
        latitude: -16.68,
        longitude: -49.25,
      }),
    );
    const result = await change.execute(
      new ChangeOrderGpsCommand(CONTA, OPERADOR, {
        orderId: PEDIDO,
        latitude: -16.7,
        longitude: -49.3,
        reason: 'Endereço corrigido pela revendedora',
      }),
    );

    // Duas linhas: a antiga INTOCADA e a nova apontando-a, com quem/motivo.
    expect(saved).toHaveLength(2);
    expect(saved[0].latitude).toBe(-16.68); // valor anterior preservado
    expect(saved[1].previousEvidenceId).toBe(saved[0].id);
    expect(saved[1].changedByUserId).toBe(OPERADOR);
    expect(saved[1].changeReason).toContain('corrigido');
    expect(result.previousEvidenceId).toBe(saved[0].id);
    // A vigente passa a ser a nova.
    expect((await repo.findCurrentGps(PEDIDO))?.latitude).toBe(-16.7);
  });

  it('alterar GPS de pedido sem captura é recusado', async () => {
    const { repo } = evidencesFalso();
    const change = new ChangeOrderGpsUseCase(repo, uowFalso);
    await expect(
      change.execute(
        new ChangeOrderGpsCommand(CONTA, OPERADOR, {
          orderId: PEDIDO,
          latitude: 0,
          longitude: 0,
          reason: 'motivo qualquer',
        }),
      ),
    ).rejects.toThrow(GpsNotCapturedException);
  });

  it('foto vai ao storage e a CHAVE fica na evidência (URL nunca persistida)', async () => {
    const { repo, saved } = evidencesFalso();
    const uc = new RegisterOrderEvidenceUseCase(repo, storageFalso, uowFalso);
    const result = await uc.execute(
      new RegisterOrderEvidenceCommand(CONTA, {
        orderId: PEDIDO,
        type: 'foto_promissoria',
        fileBase64: 'aGVsbG8=',
        fileMimeType: 'image/jpeg',
      }),
    );
    expect(result.objectKey).toContain(`evidence/${CONTA}/${PEDIDO}/foto_promissoria`);
    expect(saved[0].objectKey).toBe(result.objectKey);
  });
});
