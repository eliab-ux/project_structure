import api from 'src/services/api';
import { DispatchLog, Paginated, TodayVideo } from 'src/types';

async function history(page = 1, limit = 20): Promise<Paginated<DispatchLog>> {
  const { data } = await api.get<Paginated<DispatchLog>>('/dispatch/history', {
    params: { page, limit },
  });
  return data;
}

async function sendNow(): Promise<{
  status: string;
  message: string | null;
  reason: string | null;
}> {
  const { data } = await api.post('/dispatch/send-now');
  return data;
}

async function today(): Promise<TodayVideo> {
  const { data } = await api.get<TodayVideo>('/catalog/today');
  return data;
}

const dispatchService = { history, sendNow, today };
export default dispatchService;
