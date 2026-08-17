import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATEGORY_DIRECTIONS } from '../../../../../contexts/finance/domain/entities/financial-category.entity';
import { PAYMENT_METHODS } from '../../../../../contexts/schedule/domain/entities/reservation.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Data de calendário, nunca instante: regime de caixa (§4.15). */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateBankAccountRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  bank?: string | null;

  /**
   * Saldo inicial em centavos. **Pode ser 0 e pode ser negativo** — é saldo, não preço, e conta com
   * cheque especial estourado existe. Por isso não usa `Money`, que exige valor positivo.
   */
  @IsOptional()
  @IsInt({ message: 'O saldo inicial é em centavos, número inteiro.' })
  openingBalanceCents?: number;
}

export class UpdateBankAccountRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  bank?: string | null;

  @IsInt({ message: 'O saldo inicial é em centavos, número inteiro.' })
  openingBalanceCents!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class CreateCategoryRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  /** A direção nasce com a categoria e **não** é editável — ver `UpdateCategoryRequestDto`. */
  @IsIn(CATEGORY_DIRECTIONS, { message: 'A direção deve ser entrada (in) ou saída (out).' })
  direction!: string;
}

/**
 * Editar categoria: nome e ativação.
 *
 * **`direction` não está aqui de propósito.** Virar uma categoria de entrada em saída reclassifica
 * retroativamente todo lançamento já feito nela, e o DRE de meses fechados muda sozinho.
 */
export class UpdateCategoryRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  @IsBoolean()
  isActive!: boolean;
}

export class CreateCashEntryRequestDto {
  @IsIn(['in', 'out'], { message: 'O lançamento é entrada (in) ou saída (out).' })
  type!: 'in' | 'out';

  @Matches(CALENDAR_DATE, { message: 'A data deve estar no formato AAAA-MM-DD.' })
  occurredOn!: string;

  @IsInt({ message: 'O valor é em centavos, número inteiro.' })
  @Min(1, { message: 'O valor precisa ser maior que zero.' })
  amountCents!: number;

  @IsUUID('4', { message: 'Selecione a categoria.' })
  categoryId!: string;

  @IsUUID('4', { message: 'Selecione a conta.' })
  bankAccountId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  @Transform(trim)
  description!: string;

  /** A quem se pagou. É isto — e não uma folha — que registra salário e prestador (§4.15). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  payee?: string | null;

  @IsOptional()
  @IsIn(PAYMENT_METHODS, { message: `Forma de pagamento: ${PAYMENT_METHODS.join(', ')}.` })
  paymentMethod?: string | null;
}

export class CreateTransferRequestDto {
  @Matches(CALENDAR_DATE, { message: 'A data deve estar no formato AAAA-MM-DD.' })
  occurredOn!: string;

  @IsInt({ message: 'O valor é em centavos, número inteiro.' })
  @Min(1, { message: 'O valor precisa ser maior que zero.' })
  amountCents!: number;

  @IsUUID('4', { message: 'Selecione a conta de origem.' })
  fromAccountId!: string;

  @IsUUID('4', { message: 'Selecione a conta de destino.' })
  toAccountId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  @Transform(trim)
  description!: string;
}

/** Cancelar exige motivo: é o que sobra no histórico para explicar por que o valor sumiu do DRE. */
export class CancelCashEntryRequestDto {
  @IsString()
  @MinLength(3, { message: 'Descreva o motivo do cancelamento.' })
  @MaxLength(300)
  @Transform(trim)
  reason!: string;
}

export class PeriodQueryDto {
  @Matches(CALENDAR_DATE, { message: 'Início do período no formato AAAA-MM-DD.' })
  from!: string;

  @Matches(CALENDAR_DATE, { message: 'Fim do período no formato AAAA-MM-DD.' })
  to!: string;

  @IsOptional()
  @IsUUID('4')
  bankAccountId?: string;
}

export class BalancesQueryDto {
  @IsOptional()
  @Matches(CALENDAR_DATE, { message: 'A data-limite no formato AAAA-MM-DD.' })
  until?: string;
}
