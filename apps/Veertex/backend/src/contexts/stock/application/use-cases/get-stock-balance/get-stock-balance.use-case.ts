import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../ports/output/stock-movement-repository.port';
import {
  STOCK_PRODUCT_LOOKUP,
  StockProductLookupPort,
} from '../../ports/output/stock-product-lookup.port';
import {
  STOCK_RESERVATION_REPOSITORY,
  StockReservationRepositoryPort,
} from '../../ports/output/stock-reservation-repository.port';
import { computeBalance } from '../../../domain/stock-balance';
import { StockBalanceDto } from '../../dto/stock.dto';
import { StockProductInvalidException } from '../../../domain/exceptions/stock-exceptions';

export class GetStockBalanceQuery {
  constructor(
    public readonly companyId: string,
    public readonly productId: string,
  ) {}
}

/**
 * Saldo + custo médio + disponível de um `(empresa, produto)`, tudo DERIVADO dos movimentos (§3.1).
 *
 * Os alertas de mínimo/máximo (§3.5 do CORE) saem daqui: comparam os parâmetros que JÁ vivem no
 * produto com o saldo — sem duplicar os parâmetros no EST. O `available` é físico − reservas ativas;
 * enquanto o módulo de reserva não existir, é igual ao físico.
 */
@Injectable()
export class GetStockBalanceUseCase implements UseCase<GetStockBalanceQuery, StockBalanceDto> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_PRODUCT_LOOKUP) private readonly products: StockProductLookupPort,
    @Inject(STOCK_RESERVATION_REPOSITORY)
    private readonly reservations: StockReservationRepositoryPort,
  ) {}

  async execute(query: GetStockBalanceQuery): Promise<StockBalanceDto> {
    const product = await this.products.findById(query.productId);
    if (!product) {
      throw new StockProductInvalidException('Produto não encontrado.');
    }

    const movements = await this.movements.listByCompanyProduct(query.companyId, query.productId);
    const balance = computeBalance(movements.map((m) => m.toBalanceInput()));

    // Disponível = físico − reservas ativas e NÃO VENCIDAS (expiração preguiçosa, §3.9).
    const reserved = await this.reservations.sumActiveReserved(
      query.companyId,
      query.productId,
      new Date(),
    );

    return StockBalanceDto.build({
      companyId: query.companyId,
      productId: query.productId,
      productName: product.name,
      balance,
      available: Math.max(0, balance.quantity - reserved),
      minimumQuantity: product.minimumQuantity,
      maximumQuantity: product.maximumQuantity,
    });
  }
}
