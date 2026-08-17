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
  fabric!: FabricRef;
  productType!: NamedRef;
  createdBy!: NamedRef;

  estimatedPieces!: number;
  metersPerPiece!: number | null;
  rolls!: number | null;
  estimatedLayers!: number | null;
  estimatedLayoutType!: LayoutType | null;
  estimatedHours!: number;
  notes!: string | null;

  createdAt!: string;

  static fromDomain(
    preOrder: PreOrder,
    refs: { customer: NamedRef; fabric: FabricRef; productType: NamedRef; createdBy: NamedRef },
  ): PreOrderDto {
    const dto = new PreOrderDto();
    dto.id = preOrder.id.value;
    dto.status = preOrder.status;
    dto.customer = refs.customer;
    dto.fabric = refs.fabric;
    dto.productType = refs.productType;
    dto.createdBy = refs.createdBy;

    const estimate = preOrder.estimate;
    dto.estimatedPieces = estimate.estimatedPieces;
    dto.metersPerPiece = estimate.metersPerPiece;
    dto.rolls = estimate.rolls;
    dto.estimatedLayers = estimate.estimatedLayers;
    dto.estimatedLayoutType = estimate.estimatedLayoutType;
    dto.estimatedHours = estimate.estimatedHours;
    dto.notes = estimate.notes;

    dto.createdAt = preOrder.createdAt.toISOString();
    return dto;
  }
}
