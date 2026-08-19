import api from 'src/services/api';
import {
  NoShowResolution,
  PaymentMethod,
  Reservation,
  ReservationForModelista,
  ScheduleEntry,
} from 'src/types/schedule';

async function agenda(from: string, to: string): Promise<ScheduleEntry[]> {
  const response = await api.get<ScheduleEntry[]>('/schedule', { params: { from, to } });
  return response.data;
}

/** O preço NÃO vai no payload: o backend o busca na máquina escolhida (decisão 2.9). */
async function createReservation(payload: {
  machineId: string;
  preOrderId: string;
  startsAt: string;
  endsAt: string;
}): Promise<Reservation> {
  const response = await api.post<Reservation>('/reservations', payload);
  return response.data;
}

async function listReservations(): Promise<Reservation[]> {
  const response = await api.get<Reservation[]>('/reservations');
  return response.data;
}

async function createConsultation(payload: {
  title: string;
  customerId?: string | null;
  startsAt: string;
  endsAt: string;
}): Promise<{ entry: ScheduleEntry; warnings: string[] }> {
  const response = await api.post<{ entry: ScheduleEntry; warnings: string[] }>(
    '/schedule/consultations',
    payload,
  );
  return response.data;
}

async function updateConsultation(
  id: string,
  payload: { title: string; customerId?: string | null; startsAt: string; endsAt: string },
): Promise<{ entry: ScheduleEntry; warnings: string[] }> {
  const response = await api.put<{ entry: ScheduleEntry; warnings: string[] }>(
    `/schedule/consultations/${id}`,
    payload,
  );
  return response.data;
}

/**
 * Mover uma hora de máquina na agenda.
 *
 * **Sem horas e sem preço no payload**: as horas saem de `endsAt − startsAt` e o preço vem da
 * máquina. Reserva paga aceita só mudança de horário — duração e máquina alterariam o total de uma
 * venda já cobrada, e o backend recusa.
 */
async function moveMachineHour(
  entryId: string,
  payload: { startsAt: string; endsAt: string; machineId?: string | null },
): Promise<{ entry: ScheduleEntry; warnings: string[] }> {
  const response = await api.patch<{ entry: ScheduleEntry; warnings: string[] }>(
    `/schedule/machine-hours/${entryId}`,
    payload,
  );
  return response.data;
}

async function removeConsultation(id: string): Promise<void> {
  await api.delete(`/schedule/consultations/${id}`);
}

/**
 * A catraca: é isto que faz a reserva aparecer para o Modelista — e o que cria a entrada de caixa,
 * no mesmo ato. Não existe segundo passo para lançar o recebimento à mão.
 *
 * `bankAccountId` só é obrigatório quando há mais de uma conta ativa; com uma só, o backend resolve.
 */
async function registerPayment(
  id: string,
  method: PaymentMethod,
  bankAccountId?: string | null,
): Promise<Reservation> {
  const response = await api.patch<Reservation>(`/reservations/${id}/payment`, {
    method,
    ...(bankAccountId ? { bankAccountId } : {}),
  });
  return response.data;
}

async function release(id: string): Promise<Reservation> {
  const response = await api.patch<Reservation>(`/reservations/${id}/release`);
  return response.data;
}

async function cancel(id: string): Promise<Reservation> {
  const response = await api.patch<Reservation>(`/reservations/${id}/cancel`);
  return response.data;
}

async function resolveNoShow(id: string, resolution: NoShowResolution): Promise<Reservation> {
  const response = await api.patch<Reservation>(`/reservations/${id}/no-show/resolution`, {
    resolution,
  });
  return response.data;
}

/**
 * Remarca o no-show: resolve a pendência e cria a reserva nova já paga, num ato só.
 *
 * **Não gera segunda entrada de caixa** — o dinheiro entrou na venda original. Devolve a reserva
 * NOVA; a original fica `no_show` com resolução `rescheduled`.
 */
async function rescheduleNoShow(
  id: string,
  payload: { startsAt: string; endsAt: string },
): Promise<Reservation> {
  const response = await api.post<Reservation>(`/reservations/${id}/no-show/reschedule`, payload);
  return response.data;
}

async function modelistaQueue(): Promise<ReservationForModelista[]> {
  const response = await api.get<ReservationForModelista[]>('/modelista/reservations');
  return response.data;
}

async function markNoShow(id: string): Promise<void> {
  await api.patch(`/modelista/reservations/${id}/no-show`);
}

const scheduleService = {
  agenda,
  createReservation,
  listReservations,
  createConsultation,
  updateConsultation,
  moveMachineHour,
  removeConsultation,
  registerPayment,
  release,
  cancel,
  resolveNoShow,
  rescheduleNoShow,
  modelistaQueue,
  markNoShow,
};
export default scheduleService;
