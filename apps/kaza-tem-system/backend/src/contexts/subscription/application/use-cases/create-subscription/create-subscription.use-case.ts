import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CreateSubscriptionCommand } from './create-subscription.command';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '../../ports/output/subscription-repository.port';
import { CieloRecurrenceService } from '@infrastructure/integrations/cielo/cielo-recurrence.service';
import { Subscription } from '../../../domain/entities/subscription.entity';
import { SubscriptionDto } from '../../dto/subscription.dto';

@Injectable()
export class CreateSubscriptionUseCase implements UseCase<
  CreateSubscriptionCommand,
  SubscriptionDto
> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    private readonly recurrenceService: CieloRecurrenceService,
  ) {}

  async execute(command: CreateSubscriptionCommand): Promise<SubscriptionDto> {
    const amount = command.amount ?? 9.9;
    const payload = {
      RecurrentPayment: {
        Amount: Math.round(amount * 100),
        Interval: 'Monthly',
        StartDate: new Date().toISOString().split('T')[0],
        RecurrenceType: 'Subscription',
        NumberOfPayments: 9999,
      },
      Customer: {
        Name: command.customer.name,
        Email: command.customer.email,
        Identity: command.customer.document,
        IdentityType: 'CPF',
      },
      CreditCard: {
        CardNumber: command.card.number,
        Holder: command.card.holder,
        ExpirationDate: command.card.expirationDate,
        SecurityCode: command.card.securityCode,
        Brand: command.card.brand,
      },
    };

    const response = await this.recurrenceService.createRecurringPayment(payload);
    const recurrenceId =
      (response?.['RecurrentPaymentId'] as string) ??
      (response?.['RecurrencyId'] as string) ??
      (response?.['RecurrentPaymentId'] as string) ??
      '';

    if (!recurrenceId) {
      throw new Error('Cielo retornou sem identificação de recorrência');
    }

    const subscription = Subscription.create({
      resellerId: command.resellerId,
      cieloRecurrenceId: recurrenceId,
      amount,
    });

    const saved = await this.repository.save(subscription);
    return SubscriptionDto.fromDomain(saved);
  }
}
