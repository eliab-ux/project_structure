import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountPreferencesReader } from '../../../../account/application/account-preferences.reader';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../ports/output/stock-movement-repository.port';
import {
  STOCK_PRODUCT_LOOKUP,
  StockProductLookupPort,
} from '../../ports/output/stock-product-lookup.port';
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../ports/output/stock-location-repository.port';
import { StockMovement } from '../../../domain/entities/stock-movement.entity';
import { computeBalance } from '../../../domain/stock-balance';
import {
  REGISTERABLE_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE,
  StockMovementType,
} from '../../../domain/movement-type';
import { StockMovementDto } from '../../dto/stock.dto';
import {
  InvalidMovementQuantityException,
  MovementTypeNotRegisterableException,
  NegativeStockNotAllowedException,
  StockLocationInvalidException,
  StockProductInvalidException,
} from '../../../domain/exceptions/stock-exceptions';

export class RegisterMovementCommand {
  constructor(
    public readonly accountId: string,
    public readonly companyId: string,
    public readonly productId: string,
    public readonly locationId: string,
    public readonly type: StockMovementType,
    /** Magnitude (>0) para in/out; COM SINAL para `inventory_adjust` (sobra + / falta −). */
    public readonly quantity: number,
    public readonly unitCost?: number | null,
    /** Devolução de cliente: o movimento de venda de origem, para reentrar pelo custo da época. */
    public readonly relatedMovementId?: string | null,
    public readonly note?: string | null,
    public readonly occurredAt?: Date | null,
  ) {}
}

/**
 * Registra um movimento (§3.6). É o único lugar que RESOLVE o custo do movimento; o fold do saldo só
 * aplica o que foi gravado (§3.1/§3.4).
 *
 * ## Custo resolvido por tipo (§3.4, decisões de Eliab 22/08/2026)
 *  - **compra**: o custo vem no input (0 = bonificação, que puxa a média para baixo);
 *  - **venda / devolução a fornecedor / perda / ajuste de saída**: estampa o custo médio da ÉPOCA
 *    (o vigente agora) — a venda guarda o custo consumido para uma futura devolução do cliente;
 *  - **devolução de cliente**: reentra pelo custo da época do movimento de VENDA original
 *    (`relatedMovementId`). Não achou a origem → **fallback** para a média vigente, e o movimento
 *    grava `usedFallback` — a exceção fica visível, não silenciosa;
 *  - **ajuste de entrada**: custo do input, ou a média vigente se não vier.
 *
 * ## Negativo (§3.2)
 * Saída que deixaria o saldo negativo é bloqueada, a menos que a conta permita
 * (`stock_allow_negative`). O default é bloquear.
 */
@Injectable()
export class RegisterMovementUseCase implements UseCase<RegisterMovementCommand, StockMovementDto> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_PRODUCT_LOOKUP) private readonly products: StockProductLookupPort,
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
    private readonly preferences: AccountPreferencesReader,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterMovementCommand): Promise<StockMovementDto> {
    return this.uow.execute(async () => {
      // O registro manual só cria os 6 tipos operacionais; transferência e rota entram por
      // use cases dedicados (§3.1 do 03A) — nunca pela porta de registro genérico.
      if (!REGISTERABLE_MOVEMENT_TYPES.includes(command.type)) {
        throw new MovementTypeNotRegisterableException(command.type);
      }

      const product = await this.products.findById(command.productId);
      if (!product || !product.active) {
        throw new StockProductInvalidException('Produto não encontrado ou inativo.');
      }

      const location = await this.locations.findById(command.locationId);
      if (!location || location.companyId !== command.companyId || !location.active) {
        throw new StockLocationInvalidException(
          'Localização não encontrada, de outra empresa, ou inativa.',
        );
      }

      const def = STOCK_MOVEMENT_TYPE[command.type];
      const isAdjust = def.direction === 'adjust';

      // adjust usa o sinal do input; os demais, a magnitude (a direção vem do tipo).
      const signedQuantity = isAdjust ? command.quantity : Math.abs(command.quantity);
      if (signedQuantity === 0) {
        throw new InvalidMovementQuantityException();
      }

      // O custo médio é da empresa (§3.4) — soma todas as localizações; o negativo é POR local.
      const existing = await this.movements.listByCompanyProduct(
        command.companyId,
        command.productId,
      );
      const current = computeBalance(existing.map((m) => m.toBalanceInput()));
      const atLocation = await this.movements.listByCompanyProductLocation(
        command.companyId,
        command.productId,
        command.locationId,
      );
      const locationBalance = computeBalance(atLocation.map((m) => m.toBalanceInput()));

      const { unitCost, usedFallback } = await this.resolveCost(command, current.averageCost);

      // Efeito no saldo, para a checagem de negativo.
      const delta =
        def.direction === 'out'
          ? -Math.abs(signedQuantity)
          : def.direction === 'in'
            ? Math.abs(signedQuantity)
            : signedQuantity;

      // O negativo é aferido NA LOCALIZAÇÃO do movimento — um armazém não pode ficar negativo
      // ainda que outro local cubra o total da empresa (§2 do 03A).
      if (locationBalance.quantity + delta < 0) {
        const prefs = await this.preferences.forAccount(command.accountId);
        if (!prefs.stockAllowNegative) {
          throw new NegativeStockNotAllowedException(
            locationBalance.quantity.toString(),
            Math.abs(delta).toString(),
          );
        }
      }

      const movement = StockMovement.create({
        accountId: command.accountId,
        companyId: command.companyId,
        productId: command.productId,
        locationId: command.locationId,
        type: command.type,
        signedQuantity,
        unitCost,
        relatedMovementId: command.relatedMovementId ?? null,
        usedFallback,
        note: command.note,
        occurredAt: command.occurredAt,
      });

      return StockMovementDto.fromDomain(await this.movements.save(movement));
    });
  }

  private async resolveCost(
    command: RegisterMovementCommand,
    currentAverage: number,
  ): Promise<{ unitCost: number | null; usedFallback: boolean }> {
    switch (command.type) {
      case 'purchase_in':
        // 0 é válido — bonificação (§3.4).
        return { unitCost: Math.max(0, command.unitCost ?? 0), usedFallback: false };

      case 'inventory_adjust':
        // Entrada por ajuste usa o custo informado, ou a média; saída por ajuste, a média.
        return command.quantity > 0
          ? { unitCost: Math.max(0, command.unitCost ?? currentAverage), usedFallback: false }
          : { unitCost: currentAverage, usedFallback: false };

      case 'sale_out':
      case 'supplier_return':
      case 'loss':
        // Saídas estampam o custo médio da época (a venda, para a devolução futura poder reusá-lo).
        return { unitCost: currentAverage, usedFallback: false };

      case 'customer_return': {
        if (command.relatedMovementId) {
          const origin = await this.movements.findById(command.relatedMovementId);
          if (
            origin &&
            origin.companyId === command.companyId &&
            origin.productId === command.productId &&
            origin.unitCost !== null
          ) {
            return { unitCost: origin.unitCost, usedFallback: false };
          }
        }
        // Fallback declarado (§3.4): reentra pela média vigente e MARCA que usou fallback.
        return { unitCost: currentAverage, usedFallback: true };
      }

      default:
        // Transferência e tipos do ROT não chegam aqui — o registro os recusa antes (gate
        // REGISTERABLE). O default mantém o switch exaustivo e explode se alguém furar o gate.
        throw new MovementTypeNotRegisterableException(command.type);
    }
  }
}
