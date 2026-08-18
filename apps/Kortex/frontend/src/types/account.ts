export interface ReportOwner {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface AccountSettings {
  id: string;
  name: string;
  city: string;
  /** Fuso IANA da operação. A agenda inteira é lida através dele. */
  timezone: string;
  reportOwner: ReportOwner | null;
}

export interface BusinessHour {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}

export interface Machine {
  id: string;
  name: string;
  model: string | null;
  hourPriceCents: number;
  isActive: boolean;
}

/** 0 = domingo, como no banco (`business_hour.weekday`). */
export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

/** 270 → '4h30'. O formato do protótipo na coluna "Horas úteis". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/** 8500 → 'R$ 85,00'. Centavos são inteiros do backend ao Intl — nunca float no meio. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
