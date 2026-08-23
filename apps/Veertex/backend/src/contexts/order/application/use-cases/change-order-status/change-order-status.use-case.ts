import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { CUSTOMER_LOOKUP, CustomerLookupPort } from '../../ports/output/customer-lookup.port';
import {
  ORDER_STOCK_RESERVATION,
  OrderStockReservationPort,
} from '../../ports/output/order-stock-reservation.port';
import { MODULES } from '../../../../module/domain/modules.catalog';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { Order } from '../../../domain/entities/order.entity';
import { OrderDto } from '../../dto/order.dto';
import {
  CreditLimitExceededException,
  OrderNotFoundException,
} from '../../../domain/exceptions/order-exceptions';

export type OrderStatusAction =
  | 'quote'
  | 'confirm'
  | 'complete'
  | 'cancel'
  | 'invoice'
  | 'open_consignment'
  | 'start_settlement'
  | 'close_consignment';

export class ChangeOrderStatusCommand {
  constructor(
    public readonly orderId: string,
    public readonly action: OrderStatusAction,
    /** Módulos ativos do TOKEN — decidem se a confirmação reserva estoque (só com EST ativo). */
    public readonly activeModules: readonly string[] = [],
  ) {}
}

/**
 * Move a situação do pedido (§3.2). O CRÉDITO é conferido AQUI, na confirmação (§2.2 / §3.4 do
 * CORE) — é quando o pedido deixa de ser rascunho e passa a ser um compromisso (e, com o EST, o
 * momento da reserva).
 *
 * V1: compara o total do pedido com o limite do contato. O crédito acumulado (títulos em aberto)
 * chega com FIN/COB; até lá o bloqueio é por pedido, e a mensagem nomeia limite e excedente. `faturar`
 * é recusado LOUD (depende de EST/FIN/FIS) — na entidade.
 */
@Injectable()
export class ChangeOrderStatusUseCase implements UseCase<ChangeOrderStatusCommand, OrderDto> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(CUSTOMER_LOOKUP) private readonly customers: CustomerLookupPort,
    @Inject(ORDER_STOCK_RESERVATION) private readonly reservation: OrderStockReservationPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ChangeOrderStatusCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.orderId);
      }

      switch (command.action) {
        case 'quote':
          // Orçamento é proposta emitida (§3.3 do 02A) — não reserva estoque nem checa crédito
          // (isso é da confirmação). Só valida que há itens e emite.
          order.quote();
          break;
        case 'confirm': {
          await this.assertWithinCreditLimit(order.contactId, order.total);
          // Reserva ANTES de mudar a situação: falta de disponível recusa a confirmação (a mensagem,
          // vinda do EST, nomeia produto e quantidade) e reverte tudo na transação do request.
          await this.reserveIfStockActive(order, command.activeModules);
          order.confirm();
          break;
        }
        case 'complete':
          order.complete();
          break;
        case 'cancel':
          order.cancel();
          // Libera as reservas do pedido. No-op se não houver (conta sem EST, ou nada reservado).
          await this.reservation.release(order.id.value, 'cancelled');
          break;
        case 'invoice':
          order.invoice(); // sempre lança no V1 — depende de EST/FIN/FIS
          break;
        case 'open_consignment':
          // Efetivação da retaguarda sobre a proposta do campo (§3.3 do 04). Sem reserva nem
          // crédito: consignação não é venda ainda — a venda se conclui no acerto.
          order.openConsignment();
          break;
        case 'start_settlement':
          order.startSettlement();
          break;
        case 'close_consignment':
          // A venda se conclui aqui (§3.2 do 04). A emissão da "venda de consignado" (FIS) e a
          // baixa do estoque vendido entram pelo fechamento da viagem (fatia 5) — fronteira 07 §2.
          order.closeConsignment();
          break;
      }

      return OrderDto.fromDomain(await this.orders.save(order));
    });
  }

  /** Reserva o estoque do pedido, só quando o EST está ativo para a conta (§3.9). */
  private async reserveIfStockActive(
    order: Order,
    activeModules: readonly string[],
  ): Promise<void> {
    if (!activeModules.includes(MODULES.EST)) {
      return;
    }
    await this.reservation.reserve({
      accountId: order.accountId,
      companyId: order.companyId,
      orderId: order.id.value,
      lines: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    });
  }

  private async assertWithinCreditLimit(contactId: string, total: number): Promise<void> {
    const customer = await this.customers.findById(contactId);
    // Sem limite definido → não bloqueia. Contato ausente é tratado como sem limite: a existência já
    // foi validada na criação, e recusar aqui viraria um erro de "contato sumiu" fora de propósito.
    if (customer?.creditLimit == null) {
      return;
    }
    if (total > customer.creditLimit) {
      throw new CreditLimitExceededException(customer.creditLimit.toFixed(2), total.toFixed(2));
    }
  }
}
