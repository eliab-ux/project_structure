import { Cut } from '../../../src/contexts/cut/domain/entities/cut.entity';
import { CutDto } from '../../../src/contexts/cut/application/dto/cut.dto';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { ReservationId } from '../../../src/contexts/schedule/domain/value-objects/reservation-id.vo';
import { FabricId } from '../../../src/contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../src/contexts/catalog/domain/value-objects/product-type-id.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import { CutAlreadyEndedException } from '../../../src/contexts/cut/domain/exceptions/cut.exceptions';

const accountId = AccountId.create();
const reservationId = ReservationId.create();
const fabricId = FabricId.create();
const productTypeId = ProductTypeId.create();

function start(at = new Date('2026-09-07T13:00:00.000Z'), sequence = 1): Cut {
  return Cut.start({ accountId, reservationId, sequence, fabricId, productTypeId, at });
}

function stopped(layers = 14, nestedPieces = 12): Cut {
  const cut = start();
  cut.stop({
    endedAt: new Date('2026-09-07T14:14:00.000Z'),
    layers,
    nestedPieces,
    layoutType: 'zigzag',
    fabricId,
    productTypeId,
    markerName: 'Matriz A',
  });
  return cut;
}

describe('Cut — dois toques, um tempo só', () => {
  it('o start deixa a matriz em andamento, sem camadas nem peças', () => {
    const cut = start();

    expect(cut.isRunning).toBe(true);
    expect(cut.endedAt).toBeNull();
    expect(cut.layers).toBeNull();
    expect(cut.nestedPieces).toBeNull();
    expect(cut.totalPieces).toBeNull();
    expect(cut.durationSeconds).toBeNull();
  });

  it('NÃO existe toque intermediário de "começou o corte"', () => {
    const metodos = Object.getOwnPropertyNames(Cut.prototype);

    expect(metodos).not.toContain('startCutting');
    expect(metodos).not.toContain('markCutStarted');
    // Só os dois toques.
    expect(metodos).toContain('stop');
    expect(Object.getOwnPropertyNames(Cut)).toContain('start');
  });

  it('o stop encerra e mede um único intervalo', () => {
    const cut = stopped();

    expect(cut.isRunning).toBe(false);
    // 13:00 → 14:14 = 74 minutos.
    expect(cut.durationSeconds).toBe(74 * 60);
  });

  it('recusa fim antes do início', () => {
    const cut = start();
    expect(() =>
      cut.stop({
        endedAt: new Date('2026-09-07T12:00:00.000Z'),
        layers: 10,
        nestedPieces: 10,
        layoutType: 'zigzag',
        fabricId,
        productTypeId,
        markerName: null,
      }),
    ).toThrow(InvalidValueException);
  });

  it('não encerra duas vezes', () => {
    const cut = stopped();
    expect(() =>
      cut.stop({
        endedAt: new Date('2026-09-07T15:00:00.000Z'),
        layers: 5,
        nestedPieces: 5,
        layoutType: 'zigzag',
        fabricId,
        productTypeId,
        markerName: null,
      }),
    ).toThrow(CutAlreadyEndedException);
  });

  it('a sequência começa em 1', () => {
    expect(() => start(new Date(), 0)).toThrow(InvalidValueException);
    expect(() => start(new Date(), 2).sequence).not.toThrow();
  });
});

describe('Cut — total_pieces é derivado, nunca digitado', () => {
  it('é camadas × peças encaixadas — o caso da planilha real', () => {
    // 12 encaixadas × 14 camadas = 168 peças.
    expect(stopped(14, 12).totalPieces).toBe(168);
  });

  it('não há caminho para informá-lo: o stop não aceita esse parâmetro', () => {
    const cut = start();
    // A assinatura de `stop` recebe layers e nestedPieces; total_pieces não é um deles.
    cut.stop({
      endedAt: new Date('2026-09-07T14:00:00.000Z'),
      layers: 20,
      nestedPieces: 8,
      layoutType: 'sheet_by_sheet',
      fabricId,
      productTypeId,
      markerName: null,
    });
    expect(cut.totalPieces).toBe(160);
  });

  it('recusa camadas ou peças não positivas', () => {
    for (const [layers, nested] of [
      [0, 10],
      [10, 0],
      [-1, 10],
      [1.5, 10],
    ]) {
      const cut = start();
      expect(() =>
        cut.stop({
          endedAt: new Date('2026-09-07T14:00:00.000Z'),
          layers,
          nestedPieces: nested,
          layoutType: 'zigzag',
          fabricId,
          productTypeId,
          markerName: null,
        }),
      ).toThrow(InvalidValueException);
    }
  });
});

describe('Cut — enfesto acima da altura do tecido: AVISO, não bloqueio', () => {
  // Malha: enfesto de até 2,5 cm, camada de 0,05 cm → cabem 50 camadas.
  const MALHA = { alturaMax: 2.5, espessura: 0.05 };

  it('avisa quando camadas × espessura passa da altura máxima', () => {
    const aviso = Cut.layersWarning(60, MALHA.alturaMax, MALHA.espessura, 'Malha');

    expect(aviso).not.toBeNull();
    // 60 × 0,05 = 3,00 cm contra os 2,50 cm cadastrados.
    expect(aviso).toMatch(/60 camadas/);
    expect(aviso).toMatch(/3,00 cm/);
    expect(aviso).toMatch(/2,50 cm/);
    expect(aviso).toMatch(/cabem 50/);
    expect(aviso).toMatch(/Apontado assim mesmo/);
  });

  it('não avisa quando o enfesto cabe na altura', () => {
    // 40 × 0,05 = 2,00 cm — dentro dos 2,50 cm.
    expect(Cut.layersWarning(40, MALHA.alturaMax, MALHA.espessura, 'Malha')).toBeNull();
  });

  it('exatamente na altura máxima não avisa — o limite é inclusivo', () => {
    expect(Cut.layersWarning(50, MALHA.alturaMax, MALHA.espessura, 'Malha')).toBeNull();
  });

  /**
   * O caso que motivou a correção. Antes, a comparação era `layers <= maxLayerHeightCm` — uma
   * contagem contra centímetros —, e 30 camadas de qualquer tecido de 2,5 cm gerava aviso. Ou seja:
   * o aviso disparava em quase todo corte real, e por isso deixava de ser lido.
   */
  it('30 camadas de malha NÃO avisam — o erro dimensional antigo avisaria', () => {
    expect(Cut.layersWarning(30, MALHA.alturaMax, MALHA.espessura, 'Malha')).toBeNull();
  });

  it('sem espessura cadastrada, SILÊNCIO — não avisa em hipótese nenhuma', () => {
    // Nem com um número de camadas absurdo: sem espessura não há altura a calcular, e chutar
    // devolveria o ruído que esta mudança veio eliminar.
    expect(Cut.layersWarning(1, 2.5, null, 'Malha')).toBeNull();
    expect(Cut.layersWarning(500, 2.5, null, 'Malha')).toBeNull();
    expect(Cut.layersWarning(500, 2.5, 0, 'Malha')).toBeNull();
  });

  it('o aviso NÃO impede o apontamento — a matriz é gravada com o valor informado', () => {
    const cut = stopped(50, 4);
    expect(cut.layers).toBe(50);
    expect(cut.totalPieces).toBe(200);
  });
});

describe('CutDto', () => {
  const refs = {
    fabric: {
      id: fabricId.value,
      name: 'Malha',
      maxLayerHeightCm: 2.5,
      layerThicknessCm: 0.05,
    },
    productType: { id: productTypeId.value, name: 'Camiseta' },
  };

  it('não expõe os campos reservados ao import do Audaces', () => {
    const dto = CutDto.fromDomain(stopped(), refs);
    const campos = Object.keys(dto);

    expect(campos).not.toContain('machineCutStartedAt');
    expect(campos).not.toContain('machineCutEndedAt');
  });

  it('traz o derivado e a duração calculados', () => {
    const dto = CutDto.fromDomain(stopped(14, 12), refs);
    expect(dto.totalPieces).toBe(168);
    expect(dto.durationSeconds).toBe(4440);
  });

  it('matriz em andamento vem com tudo do stop nulo', () => {
    const dto = CutDto.fromDomain(start(), refs);
    expect(dto).toMatchObject({
      isRunning: true,
      endedAt: null,
      layers: null,
      totalPieces: null,
      durationSeconds: null,
    });
  });
});
