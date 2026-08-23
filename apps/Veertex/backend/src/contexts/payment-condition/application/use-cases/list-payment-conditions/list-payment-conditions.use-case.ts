import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PAYMENT_CONDITION_REPOSITORY,
  PaymentConditionRepositoryPort,
} from '../../ports/output/payment-condition-repository.port';
import { PaymentConditionDto } from '../../dto/payment-condition.dto';

export class ListPaymentConditionsQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/** Lista as condições de pagamento da conta (§4.2 do 02A) — para o seletor no pedido/pagamento. */
@Injectable()
export class ListPaymentConditionsUseCase implements UseCase<
  ListPaymentConditionsQuery,
  PaymentConditionDto[]
> {
  constructor(
    @Inject(PAYMENT_CONDITION_REPOSITORY)
    private readonly conditions: PaymentConditionRepositoryPort,
  ) {}

  async execute(query: ListPaymentConditionsQuery): Promise<PaymentConditionDto[]> {
    const conditions = await this.conditions.list(query.includeInactive);
    return conditions.map((condition) => PaymentConditionDto.fromDomain(condition));
  }
}
