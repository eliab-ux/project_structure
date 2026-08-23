import { Module } from '@nestjs/common';
import { CreatePaymentConditionUseCase } from './application/use-cases/create-payment-condition/create-payment-condition.use-case';
import { ListPaymentConditionsUseCase } from './application/use-cases/list-payment-conditions/list-payment-conditions.use-case';
import { UpdatePaymentConditionUseCase } from './application/use-cases/update-payment-condition/update-payment-condition.use-case';

/**
 * Condições de pagamento nomeadas (VND — §4.2 do 02A). O `PAYMENT_CONDITION_REPOSITORY` vem do
 * @Global RepositoriesModule; este módulo cabeia os use cases (cadastro comercial, guardado por
 * `sales.settings.*`).
 */
@Module({
  providers: [
    CreatePaymentConditionUseCase,
    ListPaymentConditionsUseCase,
    UpdatePaymentConditionUseCase,
  ],
  exports: [
    CreatePaymentConditionUseCase,
    ListPaymentConditionsUseCase,
    UpdatePaymentConditionUseCase,
  ],
})
export class PaymentConditionModule {}
