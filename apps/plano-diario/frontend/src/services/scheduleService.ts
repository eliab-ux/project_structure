import api from 'src/services/api';
import { Schedule } from 'src/types';

export interface SaveSchedulePayload {
  groupJid: string;
  sendTime: string;
  timezone?: string;
  planStartDate: string;
  dayOffset?: number;
  messageTemplate?: string;
}

async function get(): Promise<Schedule> {
  const { data } = await api.get<Schedule>('/schedule');
  return data;
}

async function save(payload: SaveSchedulePayload): Promise<Schedule> {
  const { data } = await api.put<Schedule>('/schedule', payload);
  return data;
}

async function toggle(isActive: boolean): Promise<Schedule> {
  const { data } = await api.patch<Schedule>('/schedule/toggle', { isActive });
  return data;
}

const scheduleService = { get, save, toggle };
export default scheduleService;
