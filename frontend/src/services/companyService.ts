import api from 'src/services/api';
import { Company, CreateCompanyPayload, UpdateCompanyPayload } from 'src/types/admin';

async function list(includeInactive = false): Promise<Company[]> {
  const response = await api.get<Company[]>('/companies', {
    // Só vai à query quando é `true`: mandar `includeInactive=false` funcionaria igual e deixaria a
    // URL do caso comum mais suja do que precisa.
    params: includeInactive ? { includeInactive: 'true' } : undefined,
  });
  return response.data;
}

async function get(id: string): Promise<Company> {
  const response = await api.get<Company>(`/companies/${id}`);
  return response.data;
}

async function create(payload: CreateCompanyPayload): Promise<Company> {
  const response = await api.post<Company>('/companies', payload);
  return response.data;
}

async function update(id: string, payload: UpdateCompanyPayload): Promise<Company> {
  const response = await api.patch<Company>(`/companies/${id}`, payload);
  return response.data;
}

/**
 * PATCH de status, e não DELETE: empresa é desativada, nunca removida — documento fiscal a
 * referencia por anos. O backend devolve o recurso atualizado, que um 204 não poderia.
 */
async function setActive(id: string, active: boolean): Promise<Company> {
  const response = await api.patch<Company>(`/companies/${id}/status`, { active });
  return response.data;
}

const companyService = { list, get, create, update, setActive };

export default companyService;
