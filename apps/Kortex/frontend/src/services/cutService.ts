import api from 'src/services/api';
import { Cut, FabricHistory } from 'src/types/cut';

async function listByReservation(reservationId: string): Promise<Cut[]> {
  const response = await api.get<Cut[]>(`/reservations/${reservationId}/cuts`);
  return response.data;
}

/** START — o primeiro toque. */
async function start(reservationId: string, markerName?: string | null): Promise<Cut> {
  const response = await api.post<Cut>(`/reservations/${reservationId}/cuts`, { markerName });
  return response.data;
}

/**
 * STOP — o segundo e último toque.
 *
 * `totalPieces` não vai no payload: ele é `layers × nestedPieces`, calculado no backend. Mandá-lo
 * derrubaria a requisição inteira (`forbidNonWhitelisted`).
 */
async function stop(
  cutId: string,
  payload: {
    layers: number;
    nestedPieces: number;
    layoutType: string;
    fabricId?: string | null;
    productTypeId?: string | null;
    markerName?: string | null;
  },
): Promise<{ cut: Cut; warnings: string[] }> {
  const response = await api.patch<{ cut: Cut; warnings: string[] }>(
    `/cuts/${cutId}/stop`,
    payload,
  );
  return response.data;
}

async function completeReservation(reservationId: string): Promise<void> {
  await api.patch(`/reservations/${reservationId}/cuts/complete`);
}

/** O histórico que alimenta a estimativa do próximo pré-pedido. */
async function fabricHistory(fabricId: string, pieces?: number | null): Promise<FabricHistory> {
  const response = await api.get<FabricHistory>('/fabric-history', {
    params: { fabricId, ...(pieces ? { pieces } : {}) },
  });
  return response.data;
}

const cutService = { listByReservation, start, stop, completeReservation, fabricHistory };
export default cutService;
