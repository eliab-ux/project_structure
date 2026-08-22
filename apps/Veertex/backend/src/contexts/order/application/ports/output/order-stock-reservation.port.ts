export const ORDER_STOCK_RESERVATION = Symbol('ORDER_STOCK_RESERVATION');

export interface OrderReserveLine {
  productId: string;
  quantity: number;
}

/**
 * A fronteira VND → EST para reserva (§3.9). O VND conhece este port; a infraestrutura sabe que ele
 * é o EST. Assim o VND **não depende do módulo EST** nem de ele estar ativo — o adapter decide.
 *
 * `reserve` lança quando falta disponível (a mensagem, vinda do EST, nomeia produto e quantidade).
 */
export interface OrderStockReservationPort {
  reserve(params: {
    accountId: string;
    companyId: string;
    orderId: string;
    lines: readonly OrderReserveLine[];
  }): Promise<void>;

  release(orderId: string, reason: 'cancelled' | 'invoiced'): Promise<void>;
}
