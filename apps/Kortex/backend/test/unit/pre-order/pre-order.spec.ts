import { PreOrder } from '../../../src/contexts/pre-order/domain/entities/pre-order.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../src/contexts/customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../src/contexts/catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../src/contexts/catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import {
  ForbiddenHoursChangeException,
  PreOrderNotEditableException,
} from '../../../src/contexts/pre-order/domain/exceptions/pre-order.exceptions';

const accountId = AccountId.create();
const customerId = CustomerId.create();
const fabricId = FabricId.create();
const productTypeId = ProductTypeId.create();
const modelistaId = UserId.create();

function baseEstimate(overrides: Partial<Parameters<typeof PreOrder.create>[0]['estimate']> = {}) {
  return {
    estimatedPieces: 160,
    metersPerPiece: 1.35,
    rolls: 3,
    estimatedLayers: 20,
    estimatedLayoutType: 'zigzag' as const,
    estimatedHours: 3,
    notes: null,
    ...overrides,
  };
}

function build(estimate = baseEstimate()): PreOrder {
  return PreOrder.create({
    accountId,
    customerId,
    fabricId,
    productTypeId,
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

  it('recusa peças, rolos ou camadas não positivos', () => {
    expect(() => build(baseEstimate({ estimatedPieces: 0 }))).toThrow(InvalidValueException);
    expect(() => build(baseEstimate({ rolls: 0 }))).toThrow(InvalidValueException);
    expect(() => build(baseEstimate({ estimatedLayers: -1 }))).toThrow(InvalidValueException);
  });

  it('aceita os campos opcionais nulos — nem toda avaliação tem metragem e rolos', () => {
    const preOrder = build(
      baseEstimate({
        metersPerPiece: null,
        rolls: null,
        estimatedLayers: null,
        estimatedLayoutType: null,
      }),
    );
    expect(preOrder.estimate.metersPerPiece).toBeNull();
    expect(preOrder.estimate.estimatedLayoutType).toBeNull();
  });

  describe('quem pode mexer nas horas (§4.7)', () => {
    const alteracao = {
      customerId,
      fabricId,
      productTypeId,
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
        fabricId,
        productTypeId,
        // Mesmas horas: não é alteração, então não esbarra na regra.
        estimate: baseEstimate({ estimatedPieces: 200 }),
      });
      expect(preOrder.estimate.estimatedPieces).toBe(200);
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
          fabricId,
          productTypeId,
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
