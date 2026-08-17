export type PreOrderStatus = 'open' | 'reserved' | 'discarded';
export type LayoutType = 'sheet_by_sheet' | 'zigzag';
export type WaitingListStatus = 'waiting' | 'offered' | 'converted' | 'dropped';
export type SlotNoticeStatus = 'open' | 'handled';

export const PRE_ORDER_STATUS_LABELS: Record<PreOrderStatus, string> = {
  open: 'Aberto',
  reserved: 'Reservado',
  discarded: 'Descartado',
};

export const LAYOUT_TYPE_LABELS: Record<LayoutType, string> = {
  sheet_by_sheet: 'Folha a folha',
  zigzag: 'Ziguezague',
};

export const WAITING_LIST_STATUS_LABELS: Record<WaitingListStatus, string> = {
  waiting: 'Esperando',
  offered: 'Vaga oferecida',
  converted: 'Virou reserva',
  dropped: 'Desistiu',
};

export interface NamedRef {
  id: string;
  name: string;
}

export interface FabricRef extends NamedRef {
  maxLayerHeightCm: number;
  /** `null` = espessura não medida; sem ela a tela não calcula nem avisa altura. */
  layerThicknessCm: number | null;
}

export interface PreOrder {
  id: string;
  status: PreOrderStatus;
  customer: NamedRef;
  fabric: FabricRef;
  productType: NamedRef;
  createdBy: NamedRef;
  estimatedPieces: number;
  metersPerPiece: number | null;
  rolls: number | null;
  estimatedLayers: number | null;
  estimatedLayoutType: LayoutType | null;
  estimatedHours: number;
  notes: string | null;
  createdAt: string;
}

export interface WaitingListEntry {
  id: string;
  customer: NamedRef;
  preOrderId: string | null;
  fabric: NamedRef | null;
  productType: NamedRef | null;
  hoursNeeded: number;
  technicalNotes: string | null;
  wantsEarlier: boolean;
  desiredUntil: string | null;
  status: WaitingListStatus;
  offeredAt: string | null;
  customerAcceptedAt: string | null;
  createdAt: string;
}

export interface SlotNotice {
  id: string;
  note: string;
  status: SlotNoticeStatus;
  createdBy: NamedRef;
  createdAt: string;
  handledBy: NamedRef | null;
  handledAt: string | null;
}

/** '2026-08-15T13:40:00Z' → '15/08 13:40'. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** '2026-09-30' → '30/09/2026'. Data de calendário, sem fuso no meio. */
export function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
