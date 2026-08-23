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
import { PaymentConditionKind } from '../../../domain/payment-condition-kind';
import { PaymentConditionDto } from '../../dto/payment-condition.dto';
import { PaymentConditionNotFoundException } from '../../../domain/exceptions/payment-condition-exceptions';

export class UpdatePaymentConditionCommand {
  constructor(
    public readonly id: string,
    public readonly input: {
      name?: string;
      kind?: PaymentConditionKind;
      active?: boolean;
    },
  ) {}
}

/**
 * Edita/desativa uma condição de pagamento (§4.2 do 02A). `findById` primeiro, e é ele que isola:
 * id de outra conta volta `null` (escopo de tenant) → "não encontrada", indistinguível de sem acesso.
 */
@Injectable()
export class UpdatePaymentConditionUseCase implements UseCase<
  UpdatePaymentConditionCommand,
  PaymentConditionDto
> {
  constructor(
    @Inject(PAYMENT_CONDITION_REPOSITORY)
    private readonly conditions: PaymentConditionRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdatePaymentConditionCommand): Promise<PaymentConditionDto> {
    return this.uow.execute(async () => {
      const condition = await this.conditions.findById(command.id);
      if (!condition) {
        throw new PaymentConditionNotFoundException();
      }
      condition.edit(command.input);
      const saved = await this.conditions.save(condition);
      return PaymentConditionDto.fromDomain(saved);
    });
  }
}
