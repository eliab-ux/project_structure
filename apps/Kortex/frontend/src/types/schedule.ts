export type ScheduleEntryType = 'machine_hour' | 'consultation';

export type ReservationStatus =
  'pre_reserved' | 'confirmed' | 'in_progress' | 'completed' | 'released' | 'no_show' | 'cancelled';

export type PaymentMethod = 'pix' | 'cash' | 'transfer';
export type NoShowResolution = 'rescheduled' | 'written_off';

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pre_reserved: 'Pré-reservada',
  confirmed: 'Paga',
  in_progress: 'Em execução',
  completed: 'Concluída',
  released: 'Liberada',
  no_show: 'Não compareceu',
  cancelled: 'Cancelada',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  transfer: 'Transferência',
};

export interface NamedRef {
  id: string;
  name: string;
}

export interface ScheduleEntry {
  id: string;
  type: ScheduleEntryType;
  machine: NamedRef | null;
  customer: NamedRef | null;
  title: string | null;
  startsAt: string;
  endsAt: string;
  reservationId: string | null;
  reservationStatus: ReservationStatus | null;
}

export interface Reservation {
  id: string;
  scheduleEntryId: string;
  preOrderId: string;
  customer: NamedRef;
  machine: NamedRef;
  startsAt: string;
  endsAt: string;
  hours: number;
  hourPriceCents: number;
  totalCents: number;
  status: ReservationStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paidRegisteredBy: NamedRef | null;
  noShowAt: string | null;
  noShowResolution: NoShowResolution | null;
}

/** A reserva como o Modelista a recebe. Sem preço, sem total, sem pagamento. */
export interface ReservationForModelista {
  id: string;
  customer: NamedRef;
  machine: NamedRef;
  startsAt: string;
  endsAt: string;
  hours: number;
  status: ReservationStatus;
  preOrderId: string;
}

/** '2026-09-07T10:00:00Z' → '07:00' no relógio local. */
export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Minutos desde a meia-noite local — a base do posicionamento na grade. */
export function minutesOfDay(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Reparte compromissos que se sobrepõem em faixas lado a lado (spec §4.8).
 *
 * Devolve, para cada compromisso, a fração da largura que ele ocupa e em qual coluna — o padrão
 * de calendário do Teams/Outlook. Não empilha um sobre o outro nem esconde o de baixo: os dois
 * precisam ser vistos, porque quem decide o que fazer com a sobreposição é o Administrativo.
 *
 * O algoritmo é o clássico de "grupos de sobreposição": entradas que se tocam formam um grupo, e
 * o grupo divide a largura pelo número de colunas necessárias.
 */
export interface LaidOutEntry<T> {
  entry: T;
  /** 0..1 — posição horizontal dentro da faixa. */
  left: number;
  /** 0..1 — largura ocupada. */
  width: number;
}

export function layoutOverlaps<T extends { startsAt: string; endsAt: string }>(
  entries: T[],
): LaidOutEntry<T>[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const result: LaidOutEntry<T>[] = [];
  let group: T[] = [];
  let groupEnd = 0;

  const flush = () => {
    if (group.length === 0) {
      return;
    }
    // Colunas dentro do grupo: a primeira coluna livre no momento em que a entrada começa.
    const columnEnds: number[] = [];
    const placed = group.map((entry) => {
      const start = new Date(entry.startsAt).getTime();
      const end = new Date(entry.endsAt).getTime();
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column === -1) {
        column = columnEnds.length;
      }
      columnEnds[column] = end;
      return { entry, column };
    });

    const columns = columnEnds.length;
    for (const { entry, column } of placed) {
      result.push({ entry, left: column / columns, width: 1 / columns });
    }
    group = [];
  };

  for (const entry of sorted) {
    const start = new Date(entry.startsAt).getTime();
    if (group.length > 0 && start >= groupEnd) {
      flush();
      groupEnd = 0;
    }
    group.push(entry);
    groupEnd = Math.max(groupEnd, new Date(entry.endsAt).getTime());
  }
  flush();

  return result;
}
