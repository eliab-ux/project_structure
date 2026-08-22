import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { CUSTOMER_LOOKUP, CustomerLookupPort } from '../../ports/output/customer-lookup.port';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderDto } from '../../dto/order.dto';
import {
  CreditLimitExceededException,
  OrderNotFoundException,
} from '../../../domain/exceptions/order-exceptions';

export type OrderStatusAction = 'confirm' | 'complete' | 'cancel' | 'invoice';

export class ChangeOrderStatusCommand {
  constructor(
    public readonly orderId: string,
    public readonly action: OrderStatusAction,
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
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ChangeOrderStatusCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.orderId);
      }

      switch (command.action) {
        case 'confirm': {
          await this.assertWithinCreditLimit(order.contactId, order.total);
          order.confirm();
          break;
        }
        case 'complete':
          order.complete();
          break;
        case 'cancel':
          order.cancel();
          break;
        case 'invoice':
          order.invoice(); // sempre lança no V1 — depende de EST/FIN/FIS
          break;
      }

      return OrderDto.fromDomain(await this.orders.save(order));
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
