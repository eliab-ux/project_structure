import { formatInTimeZone } from 'date-fns-tz';

/**
 * Data civil (`yyyy-MM-dd`) de um instante num fuso IANA.
 * Isolado aqui porque é a única conversão de fuso do sistema — o resto do domínio trabalha
 * só com strings `yyyy-MM-dd`, sem `Date`, e por isso não tem como errar por DST.
 */
export function localDateInTimeZone(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'yyyy-MM-dd');
}

/** Hora local (`HH:mm`) de um instante num fuso IANA — usada pelo scheduler na Fase 6. */
export function localTimeInTimeZone(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'HH:mm');
}
