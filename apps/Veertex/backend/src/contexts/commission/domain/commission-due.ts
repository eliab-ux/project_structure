/**
 * Vencimento da comissão materializada como conta a pagar (registro de 23/08/2026).
 *
 * `last_day_of_period`: último dia do mês apurado — o comportamento original do adapter.
 * `day_n_next_month`: dia N do mês seguinte ao apurado — o padrão de mercado (folha no início do
 * mês). N é 1-28 por construção (a preferência clampa): a regra nunca depende de o mês ter 29+.
 *
 * Função PURA e única — o adapter do Modelo A e o fechamento da viagem (Modelo B) usam a MESMA;
 * duas cópias divergiriam no primeiro ajuste.
 */
export interface CommissionDuePrefs {
  commissionDueRule: 'last_day_of_period' | 'day_n_next_month';
  commissionDueDay: number;
}

/** `period` = 'YYYY-MM' (Modelo A) ou a data-base do fechamento (Modelo B → mês do fechamento). */
export function commissionDueDate(period: string | Date, prefs: CommissionDuePrefs): Date {
  const [year, monthIndex] =
    typeof period === 'string'
      ? [Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1]
      : [period.getUTCFullYear(), period.getUTCMonth()];

  if (prefs.commissionDueRule === 'day_n_next_month') {
    const day = Math.min(28, Math.max(1, Math.trunc(prefs.commissionDueDay)));
    return new Date(Date.UTC(year, monthIndex + 1, day));
  }
  // Último dia do mês do período: dia 0 do mês seguinte.
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}
