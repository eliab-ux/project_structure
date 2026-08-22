import { StockMovement } from '../../domain/entities/stock-movement.entity';
import { StockLocation } from '../../domain/entities/stock-location.entity';
import { StockBalance } from '../../domain/stock-balance';
import { STOCK_MOVEMENT_TYPE } from '../../domain/movement-type';

export class StockMovementDto {
  id!: string;
  companyId!: string;
  productId!: string;
  locationId!: string;
  type!: string;
  typeLabel!: string;
  signedQuantity!: number;
  unitCost!: number | null;
  /** `true` = a devolução reentrou pela média vigente por não achar a origem (§3.4). Visível. */
  usedFallback!: boolean;
  relatedMovementId!: string | null;
  note!: string | null;
  occurredAt!: Date;

  static fromDomain(movement: StockMovement): StockMovementDto {
    const dto = new StockMovementDto();
    dto.id = movement.id;
    dto.companyId = movement.companyId;
    dto.productId = movement.productId;
    dto.locationId = movement.locationId;
    dto.type = movement.type;
    dto.typeLabel = STOCK_MOVEMENT_TYPE[movement.type].label;
    dto.signedQuantity = movement.signedQuantity;
    dto.unitCost = movement.unitCost;
    dto.usedFallback = movement.usedFallback;
    dto.relatedMovementId = movement.relatedMovementId;
    dto.note = movement.note;
    dto.occurredAt = movement.occurredAt;
    return dto;
  }
}

export class StockBalanceDto {
  companyId!: string;
  productId!: string;
  productName!: string;
  quantity!: number;
  averageCost!: number;
  /** Físico − reservas ativas. Sem o módulo de reserva ainda, é igual ao físico. */
  available!: number;
  minimumQuantity!: number | null;
  maximumQuantity!: number | null;
  /** Alertas (§3.5 do CORE): lidos dos parâmetros do produto contra o saldo. */
  belowMinimum!: boolean;
  aboveMaximum!: boolean;

  static build(params: {
    companyId: string;
    productId: string;
    productName: string;
    balance: StockBalance;
    available: number;
    minimumQuantity: number | null;
    maximumQuantity: number | null;
  }): StockBalanceDto {
    const dto = new StockBalanceDto();
    dto.companyId = params.companyId;
    dto.productId = params.productId;
    dto.productName = params.productName;
    dto.quantity = params.balance.quantity;
    dto.averageCost = params.balance.averageCost;
    dto.available = params.available;
    dto.minimumQuantity = params.minimumQuantity;
    dto.maximumQuantity = params.maximumQuantity;
    dto.belowMinimum = params.minimumQuantity !== null && params.available < params.minimumQuantity;
    dto.aboveMaximum =
      params.maximumQuantity !== null && params.balance.quantity > params.maximumQuantity;
    return dto;
  }
}

export class StockLocationDto {
  id!: string;
  companyId!: string;
  kind!: string;
  name!: string;
  active!: boolean;

  static fromDomain(location: StockLocation): StockLocationDto {
    const dto = new StockLocationDto();
    dto.id = location.id;
    dto.companyId = location.companyId;
    dto.kind = location.kind;
    dto.name = location.name;
    dto.active = location.active;
    return dto;
  }
}
