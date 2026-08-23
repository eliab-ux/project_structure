/**
 * Juros e multa por atraso (§2.1 do 05) — **o FIN calcula; a COB apenas apresenta**. Função pura,
 * parâmetros por conta.
 *
 * - **Multa**: percentual ÚNICO sobre o principal em atraso (incide uma vez).
 * - **Juros**: percentual ao MÊS, pro-rata por dia (`dias/30`) sobre o principal em atraso.
 *
 * Pago em dia (na data ou antes) → zero. Desconto por antecipação é fase 2 (não entra aqui).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LateChargeParams {
  monthlyInterestPercent: number;
  finePercent: number;
}

export interface LateCharges {
  daysLate: number;
  interest: number;
  fine: number;
}

export function computeLateCharges(params: {
  principal: number;
  dueDate: Date;
  paidAt: Date;
  monthlyInterestPercent: number;
  finePercent: number;
}): LateCharges {
  const dueMidnight = Date.UTC(
    params.dueDate.getUTCFullYear(),
    params.dueDate.getUTCMonth(),
    params.dueDate.getUTCDate(),
  );
  const paidMidnight = Date.UTC(
    params.paidAt.getUTCFullYear(),
    params.paidAt.getUTCMonth(),
    params.paidAt.getUTCDate(),
  );
  const daysLate = Math.max(0, Math.round((paidMidnight - dueMidnight) / MS_PER_DAY));

  if (daysLate === 0 || params.principal <= 0) {
    return { daysLate: 0, interest: 0, fine: 0 };
  }

  const fine = round2((params.principal * params.finePercent) / 100);
  const interest = round2(
    (params.principal * (params.monthlyInterestPercent / 100) * daysLate) / 30,
  );
  return { daysLate, interest, fine };
}
