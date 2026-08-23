import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  COMPANY_REPOSITORY,
  CompanyRepositoryPort,
} from '../../../../company/application/ports/output/company-repository.port';
import { CompanyId } from '../../../../company/domain/value-objects/company-id.vo';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../../ports/output/order-repository.port';
import { CUSTOMER_LOOKUP, CustomerLookupPort } from '../../ports/output/customer-lookup.port';
import {
  ORDER_PRODUCT_LOOKUP,
  OrderProductLookupPort,
} from '../../ports/output/order-product-lookup.port';
import { Order } from '../../../domain/entities/order.entity';
import { DeliveryMode, OrderOrigin } from '../../../domain/order-origin';
import { OrderDto } from '../../dto/order.dto';
import { buildOrderItems, OrderItemInput } from '../../build-items';
import {
  DiscountNotAllowedException,
  OrderCompanyRequiredException,
  OrderCustomerInvalidException,
} from '../../../domain/exceptions/order-exceptions';

export class CreateOrderCommand {
  constructor(
    public readonly accountId: string,
    /** Quem está criando — vira o vendedor do pedido se nenhum for informado. */
    public readonly actorUserId: string,
    /** `orders.discount.grant` do TOKEN — decide se um desconto é aceito (§3.5). */
    public readonly canGrantDiscount: boolean,
    public readonly input: {
      companyId: string;
      contactId: string;
      salesRepId?: string | null;
      origin: OrderOrigin;
      deliveryMode?: DeliveryMode | null;
      originDetail?: string | null;
      tripId?: string | null;
      /** Condição de pagamento (§3.6). Ausente → herda o default do contato. */
      paymentConditionId?: string | null;
      /** Idempotência do sync de campo: reenvio com o MESMO uuid devolve o pedido existente. */
      clientUuid?: string | null;
      items: OrderItemInput[];
      discountPercent?: number | null;
      discountValue?: number | null;
      notes?: string | null;
      referenceDate?: Date | null;
      validUntil?: Date | null;
    },
  ) {}
}

/**
 * Cria um pedido em `rascunho` (§3.2 do 02). Não confirma, não reserva, não checa crédito — isso é do
 * `ChangeOrderStatusUseCase` na transição para `confirmado`. Aqui só monta e numera.
 *
 * Numeração POR EMPRESA (§2.6), obtida com lock dentro da transação. Desconto só passa com a
 * permissão `orders.discount.grant` (§3.5) — a checagem lê o `canGrantDiscount` do token, nunca um
 * campo do corpo.
 */
@Injectable()
export class CreateOrderUseCase implements UseCase<CreateOrderCommand, OrderDto> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepositoryPort,
    @Inject(CUSTOMER_LOOKUP) private readonly customers: CustomerLookupPort,
    @Inject(ORDER_PRODUCT_LOOKUP) private readonly products: OrderProductLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateOrderCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const { input } = command;

      // Idempotência do sync (proposta do app, antecipada na Leva 2): a outbox reenviou? Devolve o
      // que já existe — reenvio após queda de rede não pode virar segundo pedido.
      if (input.clientUuid) {
        const existing = await this.orders.findByClientUuid?.(input.clientUuid);
        if (existing) {
          return OrderDto.fromDomain(existing);
        }
      }

      if (!input.companyId) {
        throw new OrderCompanyRequiredException();
      }
      // Empresa da conta (escopo de tenant faz o filtro; id de outra conta volta null).
      const company = await this.companies.findById(CompanyId.from(input.companyId));
      if (!company) {
        throw new OrderCompanyRequiredException();
      }

      const customer = await this.customers.findById(input.contactId);
      if (!customer || !customer.active) {
        throw new OrderCustomerInvalidException('Cliente não encontrado ou inativo.');
      }
      if (!customer.isCustomer) {
        throw new OrderCustomerInvalidException(
          `"${customer.displayName}" não é um cliente. Ajuste os tipos do contato.`,
        );
      }

      const items = await buildOrderItems(this.products, input.items);
      const number = await this.orders.nextOrderNumber(input.companyId);

      // §3.6: o pedido carrega condição PRÓPRIA — a informada, ou o default do contato. A herança
      // acontece UMA vez, aqui: mudar o default do contato depois não reescreve pedidos passados.
      const paymentConditionId = input.paymentConditionId ?? customer.defaultPaymentConditionId;

      const order = Order.create({
        accountId: command.accountId,
        companyId: input.companyId,
        contactId: input.contactId,
        salesRepId: input.salesRepId ?? command.actorUserId,
        number,
        origin: input.origin,
        deliveryMode: input.deliveryMode,
        originDetail: input.originDetail,
        tripId: input.tripId,
        paymentConditionId,
        items,
        discountPercent: input.discountPercent,
        discountValue: input.discountValue,
        notes: input.notes,
        referenceDate: input.referenceDate,
        validUntil: input.validUntil,
      });

      if (order.hasAnyDiscount && !command.canGrantDiscount) {
        throw new DiscountNotAllowedException();
      }

      return OrderDto.fromDomain(
        await this.orders.save(order, { clientUuid: input.clientUuid ?? null }),
      );
    });
  }
}
