import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { CustomerId } from '../../../customer/domain/value-objects/customer-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { UserRole } from '../../../user/domain/value-objects/user-role.vo';
import { PreOrderId } from '../value-objects/pre-order-id.vo';
import { PreOrderItemId } from '../value-objects/pre-order-item-id.vo';
import { MatrizEstimate, PreOrderItem } from './pre-order-item.entity';
import {
  ForbiddenHoursChangeException,
  PreOrderNotEditableException,
  PreOrderWithoutMatrizException,
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

/**
 * O que o pedido estima como um todo.
 *
 * Quantidade, metragem e camadas saíram daqui: são **de cada matriz** (§4.7.1). As horas ficam,
 * porque são do pedido inteiro — o cliente compra um bloco de máquina, não uma hora por matriz.
 */
export interface PreOrderEstimate {
  estimatedHours: number;
  notes: string | null;
}

/** O que se informa ao declarar uma matriz no pedido. */
export interface MatrizInput {
  fabricId: FabricId;
  productTypeId: ProductTypeId;
  estimate: MatrizEstimate;
}

/**
 * O pré-pedido: a avaliação do Modelista antes de existir venda (spec §4.7).
 *
 * A ordem que ele materializa é a da regra 6.1 — cliente fala com o Modelista, Modelista avalia
 * tecido, metragem e quantidade e diz quantas horas reservar, Administrativo reserva e cobra. O
 * Administrativo recebe as horas **prontas** e não as edita.
 *
 * **O pedido DECLARA as matrizes** (§4.7.1). O mesmo cliente traz materiais diferentes na mesma
 * reserva — tecido X para calça, tecido Y para camiseta —, e cada matriz declarada é apontada uma
 * única vez pelo Modelista. Não existe apontar matriz que o pedido não previu.
 *
 * Pedido sem matriz não descreve trabalho nenhum, então o construtor recusa: é invariante do
 * agregado, não validação de formulário.
 */
export class PreOrder extends AggregateRoot {
  private constructor(
    private readonly _id: PreOrderId,
    private readonly _accountId: AccountId,
    private _customerId: CustomerId,
    private _items: PreOrderItem[],
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
    matrizes: MatrizInput[];
    createdByUserId: UserId;
    estimate: PreOrderEstimate;
  }): PreOrder {
    const now = new Date();
    return new PreOrder(
      PreOrderId.create(),
      input.accountId,
      input.customerId,
      PreOrder.buildItems(input.accountId, input.matrizes),
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
    items: PreOrderItem[];
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
      // Reconstrução não valida: o dado já passou pela regra quando foi gravado, e recusar aqui
      // deixaria um pedido antigo inacessível em vez de corrigível.
      [...input.items].sort((a, b) => a.sequence - b.sequence),
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
    matrizes: MatrizInput[];
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
    // As matrizes são substituídas por inteiro, e não casadas uma a uma pelo id: o pedido ainda
    // está `open`, então nenhuma foi apontada, e não há execução para preservar. Casar por id
    // aqui só criaria a ilusão de continuidade sobre linhas que ninguém usou.
    this._items = PreOrder.buildItems(this._accountId, input.matrizes);
    this._estimate = estimate;
    this.touch();
  }

  /** A matriz declarada com este id, ou `undefined`. É por ela que o apontamento entra. */
  findItem(itemId: PreOrderItemId): PreOrderItem | undefined {
    return this._items.find((item) => item.id.value === itemId.value);
  }

  private static buildItems(accountId: AccountId, matrizes: MatrizInput[]): PreOrderItem[] {
    if (matrizes.length === 0) {
      throw new PreOrderWithoutMatrizException();
    }

    // A ordem é a de chegada: a tela lista as matrizes na sequência em que foram declaradas, e é
    // essa mesma sequência que o Modelista vê ao apontar.
    return matrizes.map((matriz, index) =>
      PreOrderItem.create({
        accountId,
        sequence: index + 1,
        fabricId: matriz.fabricId,
        productTypeId: matriz.productTypeId,
        estimate: matriz.estimate,
      }),
    );
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

    return {
      ...estimate,
      notes: estimate.notes?.trim() || null,
    };
  }

  get items(): PreOrderItem[] {
    return this._items;
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
