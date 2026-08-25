import api from 'src/services/api';
import { Detection, DetectionSummary, Paginated } from 'src/types';

export interface DetectionFilters {
  watchlistOnly?: boolean;
  from?: string;
  to?: string;
  seen?: boolean;
  page?: number;
  limit?: number;
}

async function list(filters: DetectionFilters = {}): Promise<Paginated<Detection>> {
  const { data } = await api.get('/detections', { params: filters });
  return data;
}

async function summary(): Promise<DetectionSummary> {
  const { data } = await api.get('/detections/summary');
  return data;
}

async function markSeen(id: string): Promise<Detection> {
  const { data } = await api.patch(`/detections/${id}/seen`);
  return data;
}

const detectionService = { list, summary, markSeen };
export default detectionService;
