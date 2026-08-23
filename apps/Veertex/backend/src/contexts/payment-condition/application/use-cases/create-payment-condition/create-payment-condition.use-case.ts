import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PAYMENT_CONDITION_REPOSITORY,
  PaymentConditionRepositoryPort,
} from '../../ports/output/payment-condition-repository.port';
import { PaymentCondition } from '../../../domain/entities/payment-condition.entity';
import { PaymentConditionKind } from '../../../domain/payment-condition-kind';
import { PaymentConditionDto } from '../../dto/payment-condition.dto';

export class CreatePaymentConditionCommand {
  constructor(
    public readonly accountId: string,
    public readonly name: string,
    public readonly kind: PaymentConditionKind,
  ) {}
}

/** Cadastra uma condição de pagamento nomeada (§4.2 do 02A). */
@Injectable()
export class CreatePaymentConditionUseCase implements UseCase<
  CreatePaymentConditionCommand,
  PaymentConditionDto
> {
  constructor(
    @Inject(PAYMENT_CONDITION_REPOSITORY)
    private readonly conditions: PaymentConditionRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreatePaymentConditionCommand): Promise<PaymentConditionDto> {
    const condition = PaymentCondition.create({
      accountId: command.accountId,
      name: command.name,
      kind: command.kind,
    });
    return this.uow.execute(async () => {
      const saved = await this.conditions.save(condition);
      return PaymentConditionDto.fromDomain(saved);
    });
  }
}
