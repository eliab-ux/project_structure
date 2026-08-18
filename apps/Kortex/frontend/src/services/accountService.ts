import api from 'src/services/api';
import { AccountSettings, BusinessHour, ReportOwner } from 'src/types/account';

async function getSettings(): Promise<AccountSettings> {
  const response = await api.get<AccountSettings>('/account');
  return response.data;
}

async function updateSettings(payload: {
  name: string;
  city: string;
  timezone: string;
  reportOwner: ReportOwner | null;
}): Promise<AccountSettings> {
  const response = await api.put<AccountSettings>('/account', payload);
  return response.data;
}

async function listBusinessHours(): Promise<BusinessHour[]> {
  const response = await api.get<BusinessHour[]>('/account/business-hours');
  return response.data;
}

async function addBusinessHour(payload: {
  weekday: number;
  startsAt: string;
  endsAt: string;
}): Promise<BusinessHour> {
  const response = await api.post<BusinessHour>('/account/business-hours', payload);
  return response.data;
}

async function removeBusinessHour(id: string): Promise<void> {
  await api.delete(`/account/business-hours/${id}`);
}

const accountService = {
  getSettings,
  updateSettings,
  listBusinessHours,
  addBusinessHour,
  removeBusinessHour,
};
export default accountService;
