import { PreOrder } from '../../../src/contexts/pre-order/domain/entities/pre-order.entity';
import { MatrizEstimate } from '../../../src/contexts/pre-order/domain/entities/pre-order-item.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../src/contexts/customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../src/contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../src/contexts/catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import {
  ForbiddenHoursChangeException,
  PreOrderNotEditableException,
  PreOrderWithoutMatrizException,
} from '../../../src/contexts/pre-order/domain/exceptions/pre-order.exceptions';

const accountId = AccountId.create();
const customerId = CustomerId.create();
const fabricId = FabricId.create();
const outroTecido = FabricId.create();
const productTypeId = ProductTypeId.create();
const outroProduto = ProductTypeId.create();
const modelistaId = UserId.create();

function matrizEstimate(overrides: Partial<MatrizEstimate> = {}): MatrizEstimate {
  return {
    estimatedPieces: 160,
    metersPerPiece: 1.35,
    rolls: 3,
    estimatedLayers: 20,
    estimatedLayoutType: 'zigzag',
    ...overrides,
  };
}

function matriz(overrides: Partial<MatrizEstimate> = {}) {
  return { fabricId, productTypeId, estimate: matrizEstimate(overrides) };
}

function baseEstimate(overrides: Partial<{ estimatedHours: number; notes: string | null }> = {}) {
  return { estimatedHours: 3, notes: null, ...overrides };
}

function build(
  estimate = baseEstimate(),
  matrizes: Parameters<typeof PreOrder.create>[0]['matrizes'] = [matriz()],
): PreOrder {
  return PreOrder.create({
    accountId,
    customerId,
    matrizes,
    createdByUserId: modelistaId,
    estimate,
  });
}

describe('PreOrder', () => {
  it('nasce aberto e guarda quem avaliou', () => {
    const preOrder = build();
    expect(preOrder.status).toBe('open');
    expect(preOrder.createdByUserId.value).toBe(modelistaId.value);
  });

  it('exige horas inteiras de 1 ou mais — a venda é em hora cheia', () => {
    expect(() => build(baseEstimate({ estimatedHours: 0 }))).toThrow(InvalidValueException);
    expect(() => build(baseEstimate({ estimatedHours: 2.5 }))).toThrow(InvalidValueException);
    expect(() => build(baseEstimate({ estimatedHours: 1 })).status).not.toThrow();
  });

  /**
   * As horas são do PEDIDO, não da matriz: o cliente compra um bloco de máquina. Se cada matriz
   * tivesse a sua hora, o tempo entre uma e outra — que aconteceu dentro do bloco comprado —
   * ficaria fora da conta.
   */
  it('as horas são uma só, com uma ou com três matrizes', () => {
    const preOrder = build(baseEstimate({ estimatedHours: 4 }), [
      matriz(),
      { fabricId: outroTecido, productTypeId: outroProduto, estimate: matrizEstimate() },
      matriz({ estimatedPieces: 40 }),
    ]);

    expect(preOrder.estimate.estimatedHours).toBe(4);
    expect(preOrder.items).toHaveLength(3);
  });

  describe('as matrizes declaradas (§4.7.1)', () => {
    it('numera na ordem de chegada, começando em 1', () => {
      const preOrder = build(baseEstimate(), [
        matriz(),
        { fabricId: outroTecido, productTypeId: outroProduto, estimate: matrizEstimate() },
      ]);

      expect(preOrder.items.map((item) => item.sequence)).toEqual([1, 2]);
      expect(preOrder.items[1].fabricId.value).toBe(outroTecido.value);
      expect(preOrder.items[1].productTypeId.value).toBe(outroProduto.value);
    });

    it('cada matriz tem o SEU tecido e o SEU produto — é o caso real do cliente', () => {
      const preOrder = build(baseEstimate(), [
        matriz(),
        { fabricId: outroTecido, productTypeId: outroProduto, estimate: matrizEstimate() },
      ]);

      const tecidos = preOrder.items.map((item) => item.fabricId.value);
      expect(new Set(tecidos).size).toBe(2);
    });

    it('recusa pedido sem matriz nenhuma — não descreve trabalho algum', () => {
      expect(() => build(baseEstimate(), [])).toThrow(PreOrderWithoutMatrizException);
    });

    it('recusa peças, rolos ou camadas não positivos na matriz', () => {
      expect(() => build(baseEstimate(), [matriz({ estimatedPieces: 0 })])).toThrow(
        InvalidValueException,
      );
      expect(() => build(baseEstimate(), [matriz({ rolls: 0 })])).toThrow(InvalidValueException);
      expect(() => build(baseEstimate(), [matriz({ estimatedLayers: -1 })])).toThrow(
        InvalidValueException,
      );
    });

    it('aceita os campos opcionais nulos — nem toda avaliação tem metragem e rolos', () => {
      const preOrder = build(baseEstimate(), [
        matriz({
          metersPerPiece: null,
          rolls: null,
          estimatedLayers: null,
          estimatedLayoutType: null,
        }),
      ]);

      expect(preOrder.items[0].estimate.metersPerPiece).toBeNull();
      expect(preOrder.items[0].estimate.estimatedLayoutType).toBeNull();
    });

    it('encontra a matriz pelo id — é por ela que o apontamento entra', () => {
      const preOrder = build(baseEstimate(), [matriz(), matriz({ estimatedPieces: 40 })]);
      const segunda = preOrder.items[1];

      expect(preOrder.findItem(segunda.id)?.sequence).toBe(2);
    });
  });

  describe('quem pode mexer nas horas (§4.7)', () => {
    const alteracao = {
      customerId,
      matrizes: [matriz()],
      estimate: baseEstimate({ estimatedHours: 5 }),
    };

    it('o Modelista altera', () => {
      const preOrder = build();
      preOrder.update({ actorRole: 'modelista', ...alteracao });
      expect(preOrder.estimate.estimatedHours).toBe(5);
    });

    it('o dono NÃO altera — nem ele', () => {
      const preOrder = build();
      expect(() => preOrder.update({ actorRole: 'owner', ...alteracao })).toThrow(
        ForbiddenHoursChangeException,
      );
      expect(preOrder.estimate.estimatedHours).toBe(3);
    });

    it('o Administrativo NÃO altera', () => {
      const preOrder = build();
      expect(() => preOrder.update({ actorRole: 'admin', ...alteracao })).toThrow(
        ForbiddenHoursChangeException,
      );
    });

    it('o dono edita o RESTO sem tocar nas horas', () => {
      const preOrder = build();
      preOrder.update({
        actorRole: 'owner',
        customerId,
        matrizes: [matriz({ estimatedPieces: 200 })],
        // Mesmas horas: não é alteração, então não esbarra na regra.
        estimate: baseEstimate(),
      });
      expect(preOrder.items[0].estimate.estimatedPieces).toBe(200);
    });

    it('editar troca as matrizes por inteiro e renumera', () => {
      const preOrder = build();
      preOrder.update({
        actorRole: 'modelista',
        customerId,
        matrizes: [
          matriz(),
          { fabricId: outroTecido, productTypeId: outroProduto, estimate: matrizEstimate() },
        ],
        estimate: baseEstimate(),
      });

      expect(preOrder.items.map((item) => item.sequence)).toEqual([1, 2]);
    });
  });

  describe('ciclo de vida', () => {
    it('vira reserva e para de ser editável', () => {
      const preOrder = build();
      preOrder.markReserved();

      expect(preOrder.status).toBe('reserved');
      expect(() =>
        preOrder.update({
          actorRole: 'modelista',
          customerId,
          matrizes: [matriz()],
          estimate: baseEstimate(),
        }),
      ).toThrow(PreOrderNotEditableException);
    });

    it('descartado não volta atrás', () => {
      const preOrder = build();
      preOrder.discard();

      expect(preOrder.status).toBe('discarded');
      expect(() => preOrder.discard()).toThrow(PreOrderNotEditableException);
      expect(() => preOrder.markReserved()).toThrow(PreOrderNotEditableException);
    });
  });
});
