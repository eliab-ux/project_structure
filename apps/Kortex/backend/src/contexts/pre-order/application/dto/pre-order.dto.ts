import { PreOrder, PreOrderStatus } from '../../domain/entities/pre-order.entity';
import { LayoutType } from '../../../../shared/domain/value-objects/layout-type';

export interface NamedRef {
  id: string;
  name: string;
}

export interface FabricRef extends NamedRef {
  /** Vem junto porque é ela que sustenta a estimativa de camadas na tela (spec §4.5). */
  maxLayerHeightCm: number;
  /** `null` = espessura ainda não medida; sem ela não há aviso de altura no stop. */
  layerThicknessCm: number | null;
}

/** Uma matriz declarada, como a tela a mostra. */
export class PreOrderItemDto {
  id!: string;
  sequence!: number;
  fabric!: FabricRef;
  productType!: NamedRef;
  estimatedPieces!: number;
  metersPerPiece!: number | null;
  rolls!: number | null;
  estimatedLayers!: number | null;
  estimatedLayoutType!: LayoutType | null;
}

/**
 * Pré-pedido como as duas telas o consomem — a do Modelista e a do Administrativo.
 *
 * **Um DTO só, e serve aos dois**: não há campo monetário nenhum aqui. Preço e total nascem na
 * reserva (Fase 4), não no pré-pedido — é exatamente por isso que o Modelista pode ver este
 * objeto inteiro sem violar a §5.
 */
export class PreOrderDto {
  id!: string;
  status!: PreOrderStatus;
  customer!: NamedRef;
  createdBy!: NamedRef;

  /**
   * As matrizes declaradas, em ordem. Sempre ao menos uma (§4.7.1).
   *
   * Tecido e produto vivem aqui, e não no pedido: o mesmo cliente traz materiais diferentes na
   * mesma reserva, e um par de campos no topo não teria onde pôr o segundo.
   */
  matrizes!: PreOrderItemDto[];

  /** Do pedido inteiro — o cliente compra um bloco de máquina, não uma hora por matriz. */
  estimatedHours!: number;
  notes!: string | null;

  createdAt!: string;

  static fromDomain(
    preOrder: PreOrder,
    refs: {
      customer: NamedRef;
      createdBy: NamedRef;
      /** Resolvidos uma vez por página pelo `ReferenceResolver` — nunca uma consulta por matriz. */
      fabricOf: (fabricId: string) => FabricRef;
      productTypeOf: (productTypeId: string) => NamedRef;
    },
  ): PreOrderDto {
    const dto = new PreOrderDto();
    dto.id = preOrder.id.value;
    dto.status = preOrder.status;
    dto.customer = refs.customer;
    dto.createdBy = refs.createdBy;

    dto.matrizes = preOrder.items.map((item) => {
      const matriz = new PreOrderItemDto();
      matriz.id = item.id.value;
      matriz.sequence = item.sequence;
      matriz.fabric = refs.fabricOf(item.fabricId.value);
      matriz.productType = refs.productTypeOf(item.productTypeId.value);
      matriz.estimatedPieces = item.estimate.estimatedPieces;
      matriz.metersPerPiece = item.estimate.metersPerPiece;
      matriz.rolls = item.estimate.rolls;
      matriz.estimatedLayers = item.estimate.estimatedLayers;
      matriz.estimatedLayoutType = item.estimate.estimatedLayoutType;
      return matriz;
    });

    dto.estimatedHours = preOrder.estimate.estimatedHours;
    dto.notes = preOrder.estimate.notes;

    dto.createdAt = preOrder.createdAt.toISOString();
    return dto;
  }
}
