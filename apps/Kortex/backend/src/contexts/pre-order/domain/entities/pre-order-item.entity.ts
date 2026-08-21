import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { LayoutType, assertLayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { PreOrderItemId } from '../value-objects/pre-order-item-id.vo';

/** O que o pedido declara sobre uma matriz, antes de ela ser cortada. */
export interface MatrizEstimate {
  estimatedPieces: number;
  metersPerPiece: number | null;
  rolls: number | null;
  estimatedLayers: number | null;
  estimatedLayoutType: LayoutType | null;
}

/**
 * Uma matriz declarada no pedido (spec §4.7.1).
 *
 * O mesmo cliente traz materiais diferentes na mesma reserva — matriz 1 de tecido X para calça,
 * matriz 2 de tecido Y para camiseta. Cada uma tem o seu tecido e o seu produto, e é isso que
 * faz o histórico por tecido continuar exato quando o pedido tem mais de uma.
 *
 * **Declarada, não improvisada.** O apontamento (`cut`) executa uma destas e só uma; não existe
 * apontar matriz que ninguém pediu. Ela vive **dentro** do pedido — quem decide quantas existem,
 * e valida que existe ao menos uma, é o `PreOrder`.
 *
 * O tecido é FK e não texto livre (§4.5): é a altura máxima dele que sustenta a estimativa de
 * camadas, e um "malha" digitado à mão não teria altura nenhuma.
 */
export class PreOrderItem extends AggregateRoot {
  private constructor(
    private readonly _id: PreOrderItemId,
    private readonly _accountId: AccountId,
    private _sequence: number,
    private _fabricId: FabricId,
    private _productTypeId: ProductTypeId,
    private _estimate: MatrizEstimate,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    sequence: number;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    estimate: MatrizEstimate;
  }): PreOrderItem {
    const now = new Date();
    return new PreOrderItem(
      PreOrderItemId.create(),
      input.accountId,
      PreOrderItem.assertSequence(input.sequence),
      input.fabricId,
      input.productTypeId,
      PreOrderItem.assertEstimate(input.estimate),
      now,
      now,
    );
  }

  static restore(input: {
    id: PreOrderItemId;
    accountId: AccountId;
    sequence: number;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    estimate: MatrizEstimate;
    createdAt: Date;
    updatedAt: Date;
  }): PreOrderItem {
    return new PreOrderItem(
      input.id,
      input.accountId,
      input.sequence,
      input.fabricId,
      input.productTypeId,
      input.estimate,
      input.createdAt,
      input.updatedAt,
    );
  }

  private static assertSequence(sequence: number): number {
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new InvalidValueException('A ordem da matriz começa em 1.');
    }
    return sequence;
  }

  private static assertEstimate(estimate: MatrizEstimate): MatrizEstimate {
    if (!Number.isInteger(estimate.estimatedPieces) || estimate.estimatedPieces < 1) {
      throw new InvalidValueException(
        'A quantidade de peças da matriz deve ser um inteiro positivo.',
      );
    }
    PreOrderItem.assertOptionalPositiveInt(estimate.rolls, 'A quantidade de rolos');
    PreOrderItem.assertOptionalPositiveInt(estimate.estimatedLayers, 'A quantidade de camadas');

    if (estimate.metersPerPiece !== null && !(estimate.metersPerPiece > 0)) {
      throw new InvalidValueException('A metragem por peça deve ser maior que zero.');
    }
    if (estimate.estimatedLayoutType !== null) {
      assertLayoutType(estimate.estimatedLayoutType);
    }

    return estimate;
  }

  private static assertOptionalPositiveInt(value: number | null, label: string): void {
    if (value === null) {
      return;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidValueException(`${label} deve ser um inteiro positivo.`);
    }
  }

  get id(): PreOrderItemId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get sequence(): number {
    return this._sequence;
  }

  get fabricId(): FabricId {
    return this._fabricId;
  }

  get productTypeId(): ProductTypeId {
    return this._productTypeId;
  }

  get estimate(): MatrizEstimate {
    return this._estimate;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
