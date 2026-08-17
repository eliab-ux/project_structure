import { PaymentMethod } from '../../../domain/entities/reservation.entity';

export const CASH_RECORDER = Symbol('CASH_RECORDER');

export interface ReservationPaymentRecord {
  accountId: string;
  reservationId: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  /** Data em que o dinheiro entrou — regime de caixa (§4.15). */
  occurredOn: Date;
  description: string;
  registeredBy: string;
  /** Conta que recebeu. Ausente = resolver para a única conta ativa, se houver só uma. */
  bankAccountId?: string | null;
}

/**
 * Fronteira entre a venda e o caixa.
 *
 * O contexto de agenda **define** o que precisa (registrar a entrada do pagamento) e o financeiro
 * **implementa** — a dependência aponta para dentro, e o financeiro não conhece reserva além do
 * id que recebe.
 *
 * O registro acontece na **mesma transação** do pagamento: a §4.15 diz que é um ato só. Nunca
 * peça ao Administrativo para lançar a entrada uma segunda vez à mão, senão o caixa duplica.
 */
export interface CashRecorderPort {
  recordReservationPayment(record: ReservationPaymentRecord): Promise<void>;
}
