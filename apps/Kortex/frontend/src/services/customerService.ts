import api from 'src/services/api';
import { CustomerDetail, CustomerListItem } from 'src/types/customer';

/** Espelha o `CustomerRequestDto` do backend. */
export interface CustomerPayload {
  legalName: string;
  tradeName: string;
  documentType: string;
  document: string;
  stateRegistration?: string | null;
  companySize?: string | null;
  employeesCount?: number | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;
  repName: string;
  repRole?: string | null;
  repCpf: string;
  repPhone: string;
  repEmail: string;
  whatsapp: string;
  email?: string | null;
  phone?: string | null;
  isMember?: boolean;
  memberSince?: string | null;
  notes?: string | null;
}

async function list(): Promise<CustomerListItem[]> {
  const response = await api.get<CustomerListItem[]>('/customers');
  return response.data;
}

async function detail(id: string): Promise<CustomerDetail> {
  const response = await api.get<CustomerDetail>(`/customers/${id}`);
  return response.data;
}

async function create(payload: CustomerPayload): Promise<CustomerDetail> {
  const response = await api.post<CustomerDetail>('/customers', payload);
  return response.data;
}

async function update(id: string, payload: CustomerPayload): Promise<CustomerDetail> {
  const response = await api.put<CustomerDetail>(`/customers/${id}`, payload);
  return response.data;
}

/** Inativa ou reativa. Nunca exclui — os cortes do cliente são histórico. */
async function setStatus(id: string, active: boolean): Promise<CustomerDetail> {
  const response = await api.patch<CustomerDetail>(`/customers/${id}/status`, { active });
  return response.data;
}

const customerService = { list, detail, create, update, setStatus };
export default customerService;
