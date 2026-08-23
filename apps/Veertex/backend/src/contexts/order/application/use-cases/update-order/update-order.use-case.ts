import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import {
  ORDER_PRODUCT_LOOKUP,
  OrderProductLookupPort,
} from '../../ports/output/order-product-lookup.port';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { DeliveryMode, OrderOrigin } from '../../../domain/order-origin';
import { OrderDto } from '../../dto/order.dto';
import { buildOrderItems, OrderItemInput } from '../../build-items';
import {
  DiscountNotAllowedException,
  InvalidStatusTransitionException,
  OrderNotFoundException,
} from '../../../domain/exceptions/order-exceptions';

export class UpdateOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly canGrantDiscount: boolean,
    public readonly input: {
      origin?: OrderOrigin;
      deliveryMode?: DeliveryMode;
      originDetail?: string | null;
      salesRepId?: string | null;
      items?: OrderItemInput[];
      discountPercent?: number | null;
      discountValue?: number | null;
      notes?: string | null;
      referenceDate?: Date | null;
      validUntil?: Date | null;
    },
  ) {}
}

/**
 * Edita um pedido **enquanto rascunho**. Um pedido já confirmado não é editado por aqui — alterar
 * quantidade/preço depois da confirmação mexeria em reserva de estoque e (futuramente) comissão, que
 * é operação própria, não um PATCH de cadastro. Fora do rascunho, isto recusa.
 *
 * `findById` primeiro, e é ele quem isola: id de outra conta volta `null` (escopo de tenant), e a
 * resposta é "não encontrado", indistinguível de "sem permissão".
 */
@Injectable()
export class UpdateOrderUseCase implements UseCase<UpdateOrderCommand, OrderDto> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(ORDER_PRODUCT_LOOKUP) private readonly products: OrderProductLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateOrderCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.orderId);
      }
      if (order.status !== 'rascunho') {
        // Mensagem de transição inválida em vez de "só rascunho edita": é a mesma família de recusa.
        throw new InvalidStatusTransitionException(order.status, 'edição');
      }

      order.editHeader({
        origin: command.input.origin,
        deliveryMode: command.input.deliveryMode,
        originDetail: command.input.originDetail,
        salesRepId: command.input.salesRepId,
        discountPercent: command.input.discountPercent,
        discountValue: command.input.discountValue,
        notes: command.input.notes,
        referenceDate: command.input.referenceDate,
        validUntil: command.input.validUntil,
      });

      if (command.input.items !== undefined) {
        order.replaceItems(await buildOrderItems(this.products, command.input.items));
      }

      if (order.hasAnyDiscount && !command.canGrantDiscount) {
        throw new DiscountNotAllowedException();
      }

      return OrderDto.fromDomain(await this.orders.save(order));
    });
  }
}
