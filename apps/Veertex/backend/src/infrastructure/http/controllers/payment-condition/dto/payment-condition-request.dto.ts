import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PAYMENT_CONDITION_KINDS } from '../../../../../contexts/payment-condition/domain/payment-condition-kind';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePaymentConditionRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name!: string;

  @IsIn(PAYMENT_CONDITION_KINDS as unknown as string[])
  kind!: string;
}

export class UpdatePaymentConditionRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsIn(PAYMENT_CONDITION_KINDS as unknown as string[])
  kind?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListPaymentConditionsQueryDto {
  /** `true` inclui as desativadas (tela de configuração); default só ativas (seletor do pedido). */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  includeInactive?: boolean;
}
