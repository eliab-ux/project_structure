import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { RefundOrderCommand } from './refund-order.command';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { OrderId } from '../../../domain/value-objects/order-id.vo';
import { OrderNotFoundException } from '../../../domain/exceptions/order-not-found.exception';
import { OrderStatus } from '../../../domain/value-objects/order-status.vo';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';
import { CIELO_CLIENT, CieloClientPort } from '@infrastructure/integrations/cielo/cielo-client.port';

@Injectable()
export class RefundOrderUseCase implements UseCase<RefundOrderCommand, void> {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CIELO_CLIENT)
    private readonly cieloClient: CieloClientPort,
  ) {}

  async execute(command: RefundOrderCommand): Promise<void> {
    const order = await this.orderRepository.findById(OrderId.from(command.orderId));

    if (!order) {
      throw new OrderNotFoundException(`Pedido ${command.orderId} não encontrado`);
    }

    if (command.amount !== undefined && command.amount <= 0) {
      throw new BadRequestException('Valor do estorno deve ser positivo');
    }

    const allowedStatuses = [OrderStatus.PAID.value, OrderStatus.PROCESSING.value];
    if (!allowedStatuses.includes(order.status.value)) {
      throw new BadRequestException('Somente pedidos pagos ou em processamento podem ser estornados');
    }

    if (!order.paymentId) {
      throw new BadRequestException('Pedido não possui pagamento registrado');
    }

    await this.cieloClient.cancelPayment(order.paymentId, command.amount);

    await this.unitOfWork.execute(async () => {
      order.cancel(command.reason ?? 'Estorno solicitado pelo administrador');
      await this.orderRepository.save(order);
    });
  }
}
