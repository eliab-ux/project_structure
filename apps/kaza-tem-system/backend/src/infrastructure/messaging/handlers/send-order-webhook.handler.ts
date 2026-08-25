import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { OrderPaidEvent } from '@contexts/order/domain/events/order-paid.event';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '@contexts/order/application/ports/output/order-repository.port';
import { OrderId } from '@contexts/order/domain/value-objects/order-id.vo';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { createHmac } from 'crypto';
import { Order } from '@contexts/order/domain/entities/order.entity';
import { User } from '@contexts/user/domain/entities/user.entity';

@Injectable()
export class SendOrderWebhookHandler {
  private readonly logger = new Logger(SendOrderWebhookHandler.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(MarketplaceApiKeyOrmEntity)
    private readonly apiKeyRepo: EntityRepository<MarketplaceApiKeyOrmEntity>,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  @OnEvent('order.paid')
  async handle(event: OrderPaidEvent) {
    const apiKey = await this.apiKeyRepo.findOne({ isActive: true });
    if (!apiKey || !apiKey.webhookUrl || !apiKey.apiSecret) {
      this.logger.debug('Marketplace webhook not configured, skipping');
      return;
    }

    const order = await this.orderRepository.findById(OrderId.from(event.orderId));
    if (!order) {
      this.logger.warn(`Order ${event.orderId} not found for webhook`);
      return;
    }

    const user = await this.userRepository.findById(UserId.from(order.userId));
    const payload = this.buildPayload(order, user);
    const signature = this.generateSignature(payload, apiKey.apiSecret);

    try {
      await this.httpService.axiosRef.post(apiKey.webhookUrl, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      this.logger.log(`Webhook sent successfully to ${apiKey.webhookUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error('Failed to send webhook to Magis5', message);
    }
  }

  private buildPayload(order: Order, user: User | null) {
    const address = order.shippingAddress;

    return {
      event: 'order.paid',
      order_id: order.id.value,
      order_number: order.id.value,
      customer: {
        name: user?.name ?? 'Cliente Kaza Tem',
        email: user?.email?.value ?? null,
        cpf: null,
      },
      items: order.items.map((item) => ({
        sku: item.sku,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      })),
      address: {
        zip_code: address.zipCode,
        street: address.street,
        number: address.number,
        complement: address.complement ?? null,
        neighborhood: null,
        city: address.city,
        state: address.state,
      },
      shipping: {
        carrier: null,
        service: order.shippingMethod,
        cost: order.shippingCost,
      },
      amounts: {
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shippingCost,
        total: order.total,
      },
      payment: {
        method: order.paymentMethod,
        installments: 1,
      },
      created_at: order.createdAt.toISOString(),
      paid_at: order.paidAt ? order.paidAt.toISOString() : new Date().toISOString(),
    };
  }

  private generateSignature(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', secret).update(data).digest('hex');
  }
}
