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
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../ports/output/stock-location-repository.port';
import {
  STOCK_PRODUCT_LOOKUP,
  StockProductLookupPort,
} from '../../ports/output/stock-product-lookup.port';
import { StockMovement } from '../../../domain/entities/stock-movement.entity';
import { computeBalance } from '../../../domain/stock-balance';
import { StockMovementDto } from '../../dto/stock.dto';
import {
  InvalidMovementQuantityException,
  NegativeStockNotAllowedException,
  SameLocationTransferException,
  StockLocationInvalidException,
  StockProductInvalidException,
} from '../../../domain/exceptions/stock-exceptions';

export class TransferStockCommand {
  constructor(
    public readonly accountId: string,
    public readonly companyId: string,
    public readonly productId: string,
    public readonly fromLocationId: string,
    public readonly toLocationId: string,
    public readonly quantity: number,
    public readonly note?: string | null,
    public readonly occurredAt?: Date | null,
  ) {}
}

export interface TransferStockResult {
  out: StockMovementDto;
  in: StockMovementDto;
}

/**
 * Transferência interna entre DUAS localizações da MESMA empresa (§2 do 03A). É um PAR ATÔMICO:
 * `transfer_out` na origem e `transfer_in` no destino, na mesma transação — nunca um sem o outro,
 * senão a mercadoria some ou aparece.
 *
 * Não é operação fiscal (§2.4 do 03 — a transferência ENTRE EMPRESAS é que é, e depende do FIS): não
 * emite documento, não sai do enum via registro. O custo é o **custo médio vigente da empresa**,
 * estampado nos dois movimentos: o saldo total e a média da empresa ficam INALTERADOS; só muda a
 * distribuição entre localizações.
 */
@Injectable()
export class TransferStockUseCase implements UseCase<TransferStockCommand, TransferStockResult> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
    @Inject(STOCK_PRODUCT_LOOKUP) private readonly products: StockProductLookupPort,
    private readonly preferences: AccountPreferencesReader,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: TransferStockCommand): Promise<TransferStockResult> {
    return this.uow.execute(async () => {
      if (command.fromLocationId === command.toLocationId) {
        throw new SameLocationTransferException();
      }

      const quantity = Math.abs(command.quantity);
      if (quantity === 0) {
        throw new InvalidMovementQuantityException();
      }

      const product = await this.products.findById(command.productId);
      if (!product || !product.active) {
        throw new StockProductInvalidException('Produto não encontrado ou inativo.');
      }
      // KIT não tem saldo próprio (§2.5) — não há o que transferir.
      if (product.isBundle) {
        throw new StockProductInvalidException('Kit não tem saldo próprio para transferir.');
      }

      const from = await this.locations.findById(command.fromLocationId);
      const to = await this.locations.findById(command.toLocationId);
      for (const location of [from, to]) {
        if (!location || location.companyId !== command.companyId || !location.active) {
          throw new StockLocationInvalidException(
            'Localização não encontrada, de outra empresa, ou inativa.',
          );
        }
      }

      // Custo médio vigente da empresa (§3.4) — some todas as localizações; é o que os dois
      // movimentos estampam, para a média da empresa não se mover na transferência.
      const companyMovements = await this.movements.listByCompanyProduct(
        command.companyId,
        command.productId,
      );
      const company = computeBalance(companyMovements.map((m) => m.toBalanceInput()));
      const transferCost = company.averageCost;

      // O negativo é aferido NA ORIGEM.
      const originMovements = await this.movements.listByCompanyProductLocation(
        command.companyId,
        command.productId,
        command.fromLocationId,
      );
      const origin = computeBalance(originMovements.map((m) => m.toBalanceInput()));
      if (origin.quantity - quantity < 0) {
        const prefs = await this.preferences.forAccount(command.accountId);
        if (!prefs.stockAllowNegative) {
          throw new NegativeStockNotAllowedException(
            origin.quantity.toString(),
            quantity.toString(),
          );
        }
      }

      const occurredAt = command.occurredAt ?? null;
      const outMovement = StockMovement.create({
        accountId: command.accountId,
        companyId: command.companyId,
        productId: command.productId,
        locationId: command.fromLocationId,
        type: 'transfer_out',
        signedQuantity: quantity,
        unitCost: transferCost,
        relatedMovementId: null,
        usedFallback: false,
        note: command.note,
        occurredAt,
      });
      const savedOut = await this.movements.save(outMovement);

      const inMovement = StockMovement.create({
        accountId: command.accountId,
        companyId: command.companyId,
        productId: command.productId,
        locationId: command.toLocationId,
        type: 'transfer_in',
        signedQuantity: quantity,
        unitCost: transferCost,
        // Aponta a perna de saída — o par fica rastreável a partir da entrada.
        relatedMovementId: savedOut.id,
        usedFallback: false,
        note: command.note,
        occurredAt,
      });
      const savedIn = await this.movements.save(inMovement);

      return {
        out: StockMovementDto.fromDomain(savedOut),
        in: StockMovementDto.fromDomain(savedIn),
      };
    });
  }
}
