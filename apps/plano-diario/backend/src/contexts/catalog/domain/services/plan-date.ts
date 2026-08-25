/**
 * Funções puras de data do plano. Sem dependência de locale do sistema operacional:
 * locale de container é fonte clássica de bug ("28 de July" em produção).
 *
 * Toda data de plano circula como string ISO `yyyy-MM-dd` (data civil, sem hora e sem
 * timezone). Isso elimina a classe de bug em que um `Date` "22:00 de 27/07 em UTC" é lido
 * como 27/07 quando o usuário já está em 28/07.
 */

export const MONTHS_PT_BR = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-07-28` → `28 de JULHO`. Dia sem zero à esquerda, mês em maiúsculas. */
export function formatPlanDate(isoDate: string): string {
  const { month, day } = parseIsoDate(isoDate);
  return `${day} de ${MONTHS_PT_BR[month - 1]}`;
}

/**
 * Quantos dias de `fromIsoDate` até `toIsoDate`. Aritmética em UTC de propósito: as duas
 * pontas são datas civis, então não existe DST para atrapalhar.
 */
export function diffInDays(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((toUtcMillis(toIsoDate) - toUtcMillis(fromIsoDate)) / 86_400_000);
}

/**
 * Posição do dia no plano para uma data local.
 * `planStartDate` é o dia 1 (antes dele o resultado é ≤ 0 e nada será encontrado no catálogo).
 */
export function resolveDayNumber(
  localIsoDate: string,
  planStartIsoDate: string,
  dayOffset = 0,
): number {
  return diffInDays(planStartIsoDate, localIsoDate) + 1 + dayOffset;
}

/** `2026-07-28` + 5 → `2026-08-02`. */
export function addDays(isoDate: string, days: number): string {
  return toIsoDate(new Date(toUtcMillis(isoDate) + days * 86_400_000));
}

/** Formata um instante como data civil ISO em UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const match = ISO_DATE_RE.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid ISO date: expected yyyy-MM-dd, got "${isoDate}"`);
  }
  const [, year, month, day] = match;
  const parsed = { year: Number(year), month: Number(month), day: Number(day) };
  if (parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) {
    throw new Error(`Invalid ISO date: out of range "${isoDate}"`);
  }
  return parsed;
}

function toUtcMillis(isoDate: string): number {
  const { year, month, day } = parseIsoDate(isoDate);
  return Date.UTC(year, month - 1, day);
}
