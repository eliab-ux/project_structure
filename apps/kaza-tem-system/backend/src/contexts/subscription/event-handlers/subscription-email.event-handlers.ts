import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubscriptionPaymentConfirmedEvent } from '../domain/events/subscription-payment-confirmed.event';
import { SubscriptionPaymentFailedEvent } from '../domain/events/subscription-payment-failed.event';
import { SubscriptionCanceledEvent } from '../domain/events/subscription-canceled.event';
import { EmailService } from '@infrastructure/messaging/email/email.service';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';

@Injectable()
export class SubscriptionEmailEventHandlers {
  private readonly logger = new Logger(SubscriptionEmailEventHandlers.name);

  constructor(
    private readonly emailService: EmailService,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  @OnEvent('subscription.payment_confirmed')
  async onPaymentConfirmed(event: SubscriptionPaymentConfirmedEvent): Promise<void> {
    await this.notifyReseller(
      event.resellerId,
      'Pagamento confirmado',
      `Seu pagamento de assinatura foi confirmado em ${event.billingDate.toLocaleDateString()}.`,
      `<p>Seu pagamento foi processado com sucesso em ${event.billingDate.toLocaleDateString()}.</p>`,
    );
  }

  @OnEvent('subscription.payment_failed')
  async onPaymentFailed(event: SubscriptionPaymentFailedEvent): Promise<void> {
    await this.notifyReseller(
      event.resellerId,
      'Pagamento não autorizado',
      `Tentativa de pagamento em ${event.attemptedAt.toLocaleDateString()} falhou.`,
      `<p>A tentativa de cobrança em ${event.attemptedAt.toLocaleDateString()} falhou. Atualize seu cartão para evitar suspensão.</p>`,
    );
  }

  @OnEvent('subscription.canceled')
  async onSubscriptionCanceled(event: SubscriptionCanceledEvent): Promise<void> {
    await this.notifyReseller(
      event.resellerId,
      'Assinatura cancelada',
      `Sua assinatura foi cancelada em ${event.canceledAt.toLocaleDateString()}.`,
      `<p>Sua assinatura foi cancelada em ${event.canceledAt.toLocaleDateString()}.</p>`,
    );
  }

  private async notifyReseller(
    resellerId: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    try {
      const reseller = await this.resellerRepository.findById(ResellerId.from(resellerId));
      if (!reseller) {
        this.logger.warn(`Revendedor ${resellerId} não encontrado para envio de email`);
        return;
      }

      const user = await this.userRepository.findById(UserId.from(reseller.userId));
      if (!user) {
        this.logger.warn(`User ${reseller.userId} não encontrado para envio de email`);
        return;
      }

      await this.emailService.sendMail(user.email.value, subject, html, text);
    } catch (error) {
      this.logger.error('Erro enviando email de assinatura', error);
    }
  }
}
