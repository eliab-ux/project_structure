import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { LayoutType, assertLayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { UserRole } from '../../../user/domain/value-objects/user-role.vo';
import { PreOrderId } from '../value-objects/pre-order-id.vo';
import {
  ForbiddenHoursChangeException,
  PreOrderNotEditableException,
} from '../exceptions/pre-order.exceptions';

export const PRE_ORDER_STATUSES = ['open', 'reserved', 'discarded'] as const;
export type PreOrderStatus = (typeof PRE_ORDER_STATUSES)[number];

export const PRE_ORDER_STATUS_LABELS: Record<PreOrderStatus, string> = {
  open: 'Aberto',
  reserved: 'Reservado',
  discarded: 'Descartado',
};

/** Teto de sanidade: uma reserva de 24h já é o dia inteiro em qualquer operação real. */
const MAX_HOURS = 24;

export interface PreOrderEstimate {
  estimatedPieces: number;
  metersPerPiece: number | null;
  rolls: number | null;
  estimatedLayers: number | null;
  estimatedLayoutType: LayoutType | null;
  estimatedHours: number;
  notes: string | null;
}

/**
 * O pré-pedido: a avaliação do Modelista antes de existir venda (spec §4.7).
 *
 * A ordem que ele materializa é a da regra 6.1 — cliente fala com o Modelista, Modelista avalia
 * tecido, metragem e quantidade e diz quantas horas reservar, Administrativo reserva e cobra. O
 * Administrativo recebe as horas **prontas** e não as edita.
 *
 * O tecido é FK e não texto livre (§4.5): é a altura máxima dele que sustenta a estimativa de
 * camadas, e um "malha" digitado à mão não teria altura nenhuma.
 */
export class PreOrder extends AggregateRoot {
  private constructor(
    private readonly _id: PreOrderId,
    private readonly _accountId: AccountId,
    private _customerId: CustomerId,
    private _fabricId: FabricId,
    private _productTypeId: ProductTypeId,
    private readonly _createdByUserId: UserId,
    private _estimate: PreOrderEstimate,
    private _status: PreOrderStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: {
    accountId: AccountId;
    customerId: CustomerId;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    createdByUserId: UserId;
    estimate: PreOrderEstimate;
  }): PreOrder {
    const now = new Date();
    return new PreOrder(
      PreOrderId.create(),
      input.accountId,
      input.customerId,
      input.fabricId,
      input.productTypeId,
      input.createdByUserId,
      PreOrder.assertEstimate(input.estimate),
      'open',
      now,
      now,
    );
  }

  static restore(input: {
    id: PreOrderId;
    accountId: AccountId;
    customerId: CustomerId;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    createdByUserId: UserId;
    estimate: PreOrderEstimate;
    status: PreOrderStatus;
    createdAt: Date;
    updatedAt: Date;
  }): PreOrder {
    return new PreOrder(
      input.id,
      input.accountId,
      input.customerId,
      input.fabricId,
      input.productTypeId,
      input.createdByUserId,
      input.estimate,
      input.status,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * Edita a avaliação. `actorRole` não é decoração: se as horas mudarem, **só o Modelista** pode
   * ter feito isso (§4.7, §5). O resto — cliente, tecido, peças, observação — segue a permissão
   * da rota.
   */
  update(input: {
    actorRole: UserRole;
    customerId: CustomerId;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    estimate: PreOrderEstimate;
  }): void {
    this.assertEditable();

    const estimate = PreOrder.assertEstimate(input.estimate);
    if (
      estimate.estimatedHours !== this._estimate.estimatedHours &&
      input.actorRole !== 'modelista'
    ) {
      throw new ForbiddenHoursChangeException();
    }

    this._customerId = input.customerId;
    this._fabricId = input.fabricId;
    this._productTypeId = input.productTypeId;
    this._estimate = estimate;
    this.touch();
  }

  /** Chamado pela Fase 4 quando o Administrativo transforma o pré-pedido em reserva. */
  markReserved(): void {
    this.assertEditable();
    this._status = 'reserved';
    this.touch();
  }

  discard(): void {
    this.assertEditable();
    this._status = 'discarded';
    this.touch();
  }

  private assertEditable(): void {
    if (this._status !== 'open') {
      throw new PreOrderNotEditableException(this._status);
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertEstimate(estimate: PreOrderEstimate): PreOrderEstimate {
    if (!Number.isInteger(estimate.estimatedHours) || estimate.estimatedHours < 1) {
      throw new InvalidValueException('As horas estimadas devem ser um inteiro de 1 ou mais.');
    }
    if (estimate.estimatedHours > MAX_HOURS) {
      throw new InvalidValueException(`As horas estimadas não podem passar de ${MAX_HOURS}.`);
    }
    if (!Number.isInteger(estimate.estimatedPieces) || estimate.estimatedPieces < 1) {
      throw new InvalidValueException('A quantidade de peças deve ser um inteiro positivo.');
    }
    PreOrder.assertOptionalPositiveInt(estimate.rolls, 'A quantidade de rolos');
    PreOrder.assertOptionalPositiveInt(estimate.estimatedLayers, 'A quantidade de camadas');

    if (estimate.metersPerPiece !== null && !(estimate.metersPerPiece > 0)) {
      throw new InvalidValueException('A metragem por peça deve ser maior que zero.');
    }
    if (estimate.estimatedLayoutType !== null) {
      assertLayoutType(estimate.estimatedLayoutType);
    }

    return {
      ...estimate,
      notes: estimate.notes?.trim() || null,
    };
  }

  private static assertOptionalPositiveInt(value: number | null, label: string): void {
    if (value === null) {
      return;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidValueException(`${label} deve ser um inteiro positivo.`);
    }
  }

  get id(): PreOrderId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get fabricId(): FabricId {
    return this._fabricId;
  }

  get productTypeId(): ProductTypeId {
    return this._productTypeId;
  }

  get createdByUserId(): UserId {
    return this._createdByUserId;
  }

  get estimate(): PreOrderEstimate {
    return this._estimate;
  }

  get status(): PreOrderStatus {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
