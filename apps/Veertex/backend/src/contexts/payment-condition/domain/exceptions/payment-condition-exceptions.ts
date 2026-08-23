import { DomainException } from '@gitspread/domain-primitives';

export class PaymentConditionNotFoundException extends DomainException {
  constructor() {
    super('Condição de pagamento não encontrada.');
  }
}
