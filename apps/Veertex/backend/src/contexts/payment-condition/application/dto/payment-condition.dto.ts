import { PaymentCondition } from '../../domain/entities/payment-condition.entity';
import {
  PAYMENT_CONDITION_KIND_LABEL,
  PaymentConditionKind,
} from '../../domain/payment-condition-kind';

export class PaymentConditionDto {
  id!: string;
  name!: string;
  kind!: string;
  kindLabel!: string;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(condition: PaymentCondition): PaymentConditionDto {
    const dto = new PaymentConditionDto();
    dto.id = condition.id;
    dto.name = condition.name;
    dto.kind = condition.kind;
    dto.kindLabel =
      PAYMENT_CONDITION_KIND_LABEL[condition.kind as PaymentConditionKind] ?? condition.kind;
    dto.active = condition.active;
    dto.createdAt = condition.createdAt;
    return dto;
  }
}
