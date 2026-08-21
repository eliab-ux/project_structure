import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { LayoutType, assertLayoutType } from '../../../../shared/domain/value-objects/layout-type';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../catalog/domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../catalog/domain/value-objects/product-type-id.vo';
import { ReservationId } from '../../../schedule/domain/value-objects/reservation-id.vo';
import { PreOrderItemId } from '../../../pre-order/domain/value-objects/pre-order-item-id.vo';
import { CutId } from '../value-objects/cut-id.vo';
import { CutAlreadyEndedException, CutNotEndedException } from '../exceptions/cut.exceptions';

interface StopData {
  endedAt: Date;
  layers: number;
  nestedPieces: number;
  layoutType: LayoutType;
  fabricId: FabricId;
  productTypeId: ProductTypeId;
  markerName: string | null;
}

/**
 * O apontamento de uma matriz **declarada** (spec §4.10).
 *
 * O corte não nasce por vontade de quem está na máquina: ele executa um `pre_order_item` que o
 * pedido já declarou — matriz 1 tecido X calça, matriz 2 tecido Y camiseta. Um apontamento por
 * matriz declarada, garantido por índice único no banco: pedido de uma matriz tem uma contagem, e
 * não existe apontar matriz que ninguém pediu.
 *
 * **Dois toques, um tempo só**: `start` quando começa o manejo do tecido (plotter imprimindo,
 * enfesto começando) e `stop` quando a máquina de corte desliga. Não existe — e não deve existir —
 * um botão intermediário de "começou o corte": a separação entre enfesto e corte que o relatório
 * do governo pede virá do relatório nativo do Audaces na fase 7, e a decisão do dono foi que não
 * vale apontar à mão o que a máquina já mede.
 *
 * A retirada do material da esteira é do cliente e **não conta** (decisão 2.7): o tempo encerra
 * quando a máquina desliga.
 *
 * `totalPieces` **nunca é digitado** — é `layers × nestedPieces`, sempre. Verificado na planilha
 * real do cliente em nove linhas.
 */
export class Cut extends AggregateRoot {
  private constructor(
    private readonly _id: CutId,
    private readonly _accountId: AccountId,
    private readonly _reservationId: ReservationId,
    private readonly _preOrderItemId: PreOrderItemId,
    private _markerName: string | null,
    private readonly _startedAt: Date,
    private _endedAt: Date | null,
    private _layers: number | null,
    private _nestedPieces: number | null,
    private _layoutType: LayoutType | null,
    private _fabricId: FabricId,
    private _productTypeId: ProductTypeId,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  /**
   * START — o primeiro toque.
   *
   * Tecido e produto vêm herdados da matriz declarada; podem ser corrigidos no stop, porque o
   * Modelista pode descobrir na máquina que o material é outro.
   */
  static start(input: {
    accountId: AccountId;
    reservationId: ReservationId;
    preOrderItemId: PreOrderItemId;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    markerName?: string | null;
    at?: Date;
  }): Cut {
    const startedAt = input.at ?? new Date();
    return new Cut(
      CutId.create(),
      input.accountId,
      input.reservationId,
      input.preOrderItemId,
      Cut.normalizeMarker(input.markerName),
      startedAt,
      null,
      null,
      null,
      null,
      input.fabricId,
      input.productTypeId,
      new Date(),
      new Date(),
    );
  }

  static restore(input: {
    id: CutId;
    accountId: AccountId;
    reservationId: ReservationId;
    preOrderItemId: PreOrderItemId;
    markerName: string | null;
    startedAt: Date;
    endedAt: Date | null;
    layers: number | null;
    nestedPieces: number | null;
    layoutType: LayoutType | null;
    fabricId: FabricId;
    productTypeId: ProductTypeId;
    createdAt: Date;
    updatedAt: Date;
  }): Cut {
    return new Cut(
      input.id,
      input.accountId,
      input.reservationId,
      input.preOrderItemId,
      input.markerName,
      input.startedAt,
      input.endedAt,
      input.layers,
      input.nestedPieces,
      input.layoutType,
      input.fabricId,
      input.productTypeId,
      input.createdAt,
      input.updatedAt,
    );
  }

  /**
   * STOP — o segundo e último toque. Confirma camadas, peças encaixadas e tipo de enfesto.
   *
   * `totalPieces` não é parâmetro: ele é calculado. Não há como o cliente HTTP informá-lo.
   */
  stop(data: StopData): void {
    if (this._endedAt) {
      throw new CutAlreadyEndedException();
    }
    if (data.endedAt.getTime() <= this._startedAt.getTime()) {
      throw new InvalidValueException('O fim da matriz deve ser depois do início.');
    }
    if (!Number.isInteger(data.layers) || data.layers < 1) {
      throw new InvalidValueException('As camadas devem ser um inteiro positivo.');
    }
    if (!Number.isInteger(data.nestedPieces) || data.nestedPieces < 1) {
      throw new InvalidValueException('As peças encaixadas devem ser um inteiro positivo.');
    }

    this._endedAt = data.endedAt;
    this._layers = data.layers;
    this._nestedPieces = data.nestedPieces;
    this._layoutType = assertLayoutType(data.layoutType);
    this._fabricId = data.fabricId;
    this._productTypeId = data.productTypeId;
    this._markerName = Cut.normalizeMarker(data.markerName);
    this._updatedAt = new Date();
  }

  /**
   * O enfesto apontado passa da altura máxima do tecido?
   *
   * A comparação é **dimensionalmente correta**: `layers × layerThicknessCm` dá centímetros, e é
   * isso que se compara com `maxLayerHeightCm`. A versão anterior comparava a contagem de camadas
   * direto com a altura em cm — o aviso disparava em quase todo corte, e aviso que sempre aparece
   * é aviso que ninguém lê.
   *
   * **Espessura ausente → silêncio.** Sem ela não há como calcular altura nenhuma, e chutar
   * produziria exatamente o ruído que se está corrigindo. O tecido sem espessura medida
   * simplesmente não gera aviso.
   *
   * **Aviso, nunca bloqueio** (spec §4.10): quem está na máquina sabe mais que o cadastro. O
   * cadastro é a estimativa; a máquina é o fato. Devolve a mensagem ou `null`.
   */
  static layersWarning(
    layers: number,
    maxLayerHeightCm: number,
    layerThicknessCm: number | null,
    fabricName: string,
  ): string | null {
    if (layerThicknessCm === null || layerThicknessCm <= 0) {
      return null;
    }

    const alturaCm = layers * layerThicknessCm;
    if (alturaCm <= maxLayerHeightCm) {
      return null;
    }

    const cm = (value: number) => value.toFixed(2).replace('.', ',');
    const cabem = Math.floor(maxLayerHeightCm / layerThicknessCm);
    return (
      `${layers} camadas de ${fabricName} dão ${cm(alturaCm)} cm de enfesto e passam da altura ` +
      `máxima cadastrada (${cm(maxLayerHeightCm)} cm, cabem ${cabem}). Apontado assim mesmo.`
    );
  }

  private static normalizeMarker(marker: string | null | undefined): string | null {
    const value = (marker ?? '').trim();
    if (!value) {
      return null;
    }
    if (value.length > 120) {
      throw new InvalidValueException(
        'A identificação da matriz deve ter no máximo 120 caracteres.',
      );
    }
    return value;
  }

  /** `layers × nestedPieces`. Nulo enquanto a matriz não foi encerrada. */
  get totalPieces(): number | null {
    if (this._layers === null || this._nestedPieces === null) {
      return null;
    }
    return this._layers * this._nestedPieces;
  }

  /**
   * Duração em segundos — **um só tempo**, do manejo do tecido até a máquina desligar.
   *
   * Não há `layupDuration` nem `cutDuration`: a separação virá do import do Audaces (fase 7).
   */
  get durationSeconds(): number | null {
    if (!this._endedAt) {
      return null;
    }
    return Math.round((this._endedAt.getTime() - this._startedAt.getTime()) / 1000);
  }

  get isRunning(): boolean {
    return this._endedAt === null;
  }

  /** Usado pelo histórico e pela conferência do stop. Lança se a matriz ainda está em andamento. */
  requireEnded(): void {
    if (!this._endedAt) {
      throw new CutNotEndedException();
    }
  }

  get id(): CutId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get reservationId(): ReservationId {
    return this._reservationId;
  }

  /** A matriz declarada que este apontamento executa. Única — há índice único garantindo. */
  get preOrderItemId(): PreOrderItemId {
    return this._preOrderItemId;
  }

  get markerName(): string | null {
    return this._markerName;
  }

  get startedAt(): Date {
    return this._startedAt;
  }

  get endedAt(): Date | null {
    return this._endedAt;
  }

  get layers(): number | null {
    return this._layers;
  }

  get nestedPieces(): number | null {
    return this._nestedPieces;
  }

  get layoutType(): LayoutType | null {
    return this._layoutType;
  }

  get fabricId(): FabricId {
    return this._fabricId;
  }

  get productTypeId(): ProductTypeId {
    return this._productTypeId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
