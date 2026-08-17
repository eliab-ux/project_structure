import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  NO_SHOW_RESOLUTIONS,
  PAYMENT_METHODS,
} from '../../../../../contexts/schedule/domain/entities/reservation.entity';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateReservationRequestDto {
  @IsUUID('4', { message: 'Selecione a máquina.' })
  machineId!: string;

  @IsUUID('4', { message: 'Selecione o pré-pedido.' })
  preOrderId!: string;

  /**
   * Instante com fuso (ISO 8601). O alinhamento em hora cheia e a janela de funcionamento são
   * verificados no domínio, no relógio LOCAL da operação — aqui só se garante que é uma data.
   */
  @IsISO8601({ strict: true }, { message: 'Início inválido.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Fim inválido.' })
  endsAt!: string;
}

export class CreateConsultationRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  title!: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string | null;

  @IsISO8601({ strict: true }, { message: 'Início inválido.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Fim inválido.' })
  endsAt!: string;
}

export class RegisterPaymentRequestDto {
  /** Só as três formas da spec (§4.9). */
  @IsIn(PAYMENT_METHODS, { message: `Forma de pagamento: ${PAYMENT_METHODS.join(', ')}.` })
  method!: string;

  /**
   * Conta que recebeu o dinheiro. Opcional só quando existe **uma** conta ativa — com duas ou mais,
   * o use case exige a escolha em vez de adivinhar em qual conta o dinheiro caiu.
   *
   * O **valor** não está aqui de propósito: ele é o total da reserva (§4.15).
   */
  @IsOptional()
  @IsUUID('4')
  bankAccountId?: string | null;
}

export class ResolveNoShowRequestDto {
  @IsIn(NO_SHOW_RESOLUTIONS, {
    message: 'Resolução deve ser remarcar (rescheduled) ou dar baixa (written_off).',
  })
  resolution!: string;
}

/**
 * Remarcação de no-show. Só o horário novo: máquina, horas e valor vêm da reserva original, porque
 * nada novo é cobrado (§4.15).
 */
export class RescheduleNoShowRequestDto {
  @IsISO8601({ strict: true }, { message: 'Início inválido.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Fim inválido.' })
  endsAt!: string;
}

export class AgendaRangeQueryDto {
  @IsISO8601({ strict: true }, { message: 'Início do período inválido.' })
  from!: string;

  @IsISO8601({ strict: true }, { message: 'Fim do período inválido.' })
  to!: string;
}
