import { Inject, Injectable } from '@nestjs/common';
import { CommissionSalesLookupPort } from '../../../../contexts/commission/application/ports/output/commission-sales-lookup.port';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../../../contexts/order/application/ports/output/order-repository.port';

/** Situações que contam como "vendido" na apuração (§2 do 02A). Ver a fronteira no port. */
const SOLD_STATUSES = new Set(['confirmado', 'faturado', 'concluido']);

/**
 * Adapter do `CommissionSalesLookupPort` — soma o total dos pedidos do vendedor no período, via o
 * repositório de pedidos (que já é escopado por tenant + RLS). O total do pedido é DERIVADO na
 * entidade (itens − desconto), então soma-se `order.total`, não uma coluna.
 */
@Injectable()
export class CommissionSalesLookup implements CommissionSalesLookupPort {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort) {}

  async sumSoldBySalesRep(salesRepId: string, period: string): Promise<number> {
    const [year, month] = period.split('-').map(Number);
    // Intervalo [primeiro dia do mês, último instante do mês], em UTC.
    const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - 1);

    const orders = await this.orders.list({
      salesRepId,
      referenceFrom: from,
      referenceTo: to,
    });

    const total = orders
      .filter((order) => SOLD_STATUSES.has(order.status))
      .reduce((sum, order) => sum + order.total, 0);
    // Soma de valores já em 2 casas; arredonda para eliminar ruído de ponto flutuante.
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }
}
