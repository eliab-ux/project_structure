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
  STOCK_RESERVATION_REPOSITORY,
  StockReservationRepositoryPort,
} from '../../ports/output/stock-reservation-repository.port';
import {
  STOCK_PRODUCT_LOOKUP,
  StockProductLookupPort,
} from '../../ports/output/stock-product-lookup.port';
import { StockReservation } from '../../../domain/entities/stock-reservation.entity';
import { computeBalance } from '../../../domain/stock-balance';
import { NotEnoughAvailableException } from '../../../domain/exceptions/stock-exceptions';

export const DEFAULT_RESERVATION_TTL_HOURS = 72;

export interface ReserveLine {
  productId: string;
  quantity: number;
}

export class ReserveOrderStockCommand {
  constructor(
    public readonly accountId: string,
    public readonly companyId: string,
    public readonly orderId: string,
    public readonly lines: readonly ReserveLine[],
  ) {}
}

/**
 * Reserva o estoque de um pedido, tudo ou nada (§3.9). Chamado pelo VND ao CONFIRMAR.
 *
 * Para cada produto (linhas iguais são somadas), confere o DISPONÍVEL = físico − reservas ativas. Se
 * faltar e a conta não permitir negativo, recusa nomeando o produto e o quanto falta — a mensagem que
 * decide se o pedido pode ser confirmado. A checagem e as inserções rodam na MESMA transação (a do
 * VND): uma linha insuficiente derruba o pedido inteiro, sem reserva parcial.
 */
@Injectable()
export class ReserveOrderStockUseCase implements UseCase<ReserveOrderStockCommand, void> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_RESERVATION_REPOSITORY)
    private readonly reservations: StockReservationRepositoryPort,
    @Inject(STOCK_PRODUCT_LOOKUP) private readonly products: StockProductLookupPort,
    private readonly preferences: AccountPreferencesReader,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ReserveOrderStockCommand): Promise<void> {
    const byProduct = aggregate(command.lines);
    const now = new Date();

    await this.uow.execute(async () => {
      const prefs = await this.preferences.forAccount(command.accountId);

      for (const [productId, quantity] of byProduct) {
        const movements = await this.movements.listByCompanyProduct(command.companyId, productId);
        const physical = computeBalance(movements.map((m) => m.toBalanceInput())).quantity;
        const reserved = await this.reservations.sumActiveReserved(
          command.companyId,
          productId,
          now,
        );
        const available = physical - reserved;

        if (available < quantity && !prefs.stockAllowNegative) {
          const product = await this.products.findById(productId);
          throw new NotEnoughAvailableException(
            product?.name ?? productId,
            available.toString(),
            quantity.toString(),
          );
        }

        await this.reservations.save(
          StockReservation.create({
            accountId: command.accountId,
            companyId: command.companyId,
            productId,
            orderId: command.orderId,
            quantity,
            ttlHours: DEFAULT_RESERVATION_TTL_HOURS,
            now,
          }),
        );
      }
    });
  }
}

/** Soma quantidades do mesmo produto — um pedido pode ter o mesmo item em duas linhas. */
function aggregate(lines: readonly ReserveLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantity);
  }
  return map;
}
