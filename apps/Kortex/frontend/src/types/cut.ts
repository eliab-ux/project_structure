import { LayoutType, NamedRef } from 'src/types/preOrder';

export interface Cut {
  id: string;
  reservationId: string;
  sequence: number;
  markerName: string | null;
  startedAt: string;
  endedAt: string | null;
  layers: number | null;
  nestedPieces: number | null;
  /** Derivado: camadas × peças encaixadas. Nunca digitado. */
  totalPieces: number | null;
  layoutType: LayoutType | null;
  durationSeconds: number | null;
  fabric: NamedRef & { maxLayerHeightCm: number; layerThicknessCm: number | null };
  productType: NamedRef;
  isRunning: boolean;
}

/** A matriz rodando agora — o mínimo para o indicador flutuante. */
export interface RunningCut {
  cutId: string;
  reservationId: string;
  sequence: number;
  markerName: string | null;
  startedAt: string;
}

export interface FabricHistory {
  fabric: NamedRef & { maxLayerHeightCm: number; layerThicknessCm: number | null };
  samples: number;
  medianLayers: number | null;
  medianNestedPieces: number | null;
  medianTotalPieces: number | null;
  medianDurationSeconds: number | null;
  medianMinutesPer100Pieces: number | null;
  suggestedHours: number | null;
}

/**
 * Segundos → `HH:MM:SS`, com sinal quando negativo.
 *
 * O sinal é o coração do excedente: quando o restante da reserva chega a zero ele **não zera nem
 * some** — vira `+00:18:42` e conta para cima (spec §8).
 */
export function clock(totalSeconds: number): string {
  const negative = totalSeconds < 0;
  const seconds = Math.abs(Math.trunc(totalSeconds));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${negative ? '+' : ''}${hh}:${mm}:${ss}`;
}

/** '4440' → '1h14'. Formato curto do histórico. */
export function shortDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes}min`;
}
