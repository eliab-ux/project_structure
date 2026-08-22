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
    /** Recorte por localização (§2 do 03A). Ausente = saldo consolidado da empresa. */
    public readonly locationId?: string | null,
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

    const now = new Date();

    // KIT (§2.5): não tem saldo próprio — o disponível é DERIVADO dos componentes.
    if (product.isBundle) {
      return this.bundleBalance(query, product, now);
    }

    // Recorte por localização (§2 do 03A): saldo físico DAQUELE local. As reservas hoje são por
    // (empresa, produto), sem dimensão de local — então o disponível por local é o físico do local,
    // e o desconto de reservas fica no consolidado da empresa (onde a reserva realmente pesa).
    if (query.locationId) {
      const atLocation = await this.movements.listByCompanyProductLocation(
        query.companyId,
        query.productId,
        query.locationId,
      );
      const locationBalance = computeBalance(atLocation.map((m) => m.toBalanceInput()));
      return StockBalanceDto.build({
        companyId: query.companyId,
        productId: query.productId,
        productName: product.name,
        balance: locationBalance,
        available: locationBalance.quantity,
        minimumQuantity: product.minimumQuantity,
        maximumQuantity: product.maximumQuantity,
      });
    }

    const movements = await this.movements.listByCompanyProduct(query.companyId, query.productId);
    const balance = computeBalance(movements.map((m) => m.toBalanceInput()));

    // Disponível = físico − reservas ativas e NÃO VENCIDAS (expiração preguiçosa, §3.9).
    const reserved = await this.reservations.sumActiveReserved(
      query.companyId,
      query.productId,
      now,
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

  /**
   * Disponível do kit = o menor `floor(disponível_do_componente / qtd_por_kit)` entre os componentes
   * (§2.5 — o gargalo manda). Custo médio do kit = soma dos custos dos componentes por kit. Sem
   * componentes, o kit não é montável: disponível 0.
   */
  private async bundleBalance(
    query: GetStockBalanceQuery,
    product: {
      id: string;
      name: string;
      minimumQuantity: number | null;
      maximumQuantity: number | null;
      components: { productId: string; quantity: number }[];
    },
    now: Date,
  ): Promise<StockBalanceDto> {
    let kitAvailable = product.components.length > 0 ? Number.POSITIVE_INFINITY : 0;
    let assemblyCost = 0;

    for (const component of product.components) {
      const movements = await this.movements.listByCompanyProduct(
        query.companyId,
        component.productId,
      );
      const componentBalance = computeBalance(movements.map((m) => m.toBalanceInput()));
      const reserved = await this.reservations.sumActiveReserved(
        query.companyId,
        component.productId,
        now,
      );
      const componentAvailable = Math.max(0, componentBalance.quantity - reserved);
      kitAvailable = Math.min(kitAvailable, Math.floor(componentAvailable / component.quantity));
      assemblyCost += componentBalance.averageCost * component.quantity;
    }

    const quantity = Number.isFinite(kitAvailable) ? kitAvailable : 0;
    return StockBalanceDto.build({
      companyId: query.companyId,
      productId: query.productId,
      productName: product.name,
      balance: { quantity, averageCost: Math.round(assemblyCost * 10000) / 10000 },
      available: quantity,
      minimumQuantity: product.minimumQuantity,
      maximumQuantity: product.maximumQuantity,
    });
  }
}
