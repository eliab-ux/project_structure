import api from 'src/services/api';
import {
  Contact,
  ContactFieldDefinition,
  CreateContactPayload,
  UpdateContactPayload,
} from 'src/types/admin';

async function list(params: {
  search?: string;
  type?: string;
  includeInactive?: boolean;
}): Promise<Contact[]> {
  const response = await api.get<Contact[]>('/contacts', { params });
  return response.data;
}

/**
 * O catálogo de campos. Vem do backend porque ele é fixo em CÓDIGO (§3.6) e porque, quando
 * `field_config` existir, esta mesma rota devolverá o catálogo já mesclado com a configuração da
 * conta — a tela não muda.
 */
async function fieldCatalog(): Promise<ContactFieldDefinition[]> {
  const response = await api.get<{ fields: ContactFieldDefinition[] }>('/contacts/field-catalog');
  return response.data.fields;
}

async function create(payload: CreateContactPayload): Promise<Contact> {
  const response = await api.post<Contact>('/contacts', payload);
  return response.data;
}

async function update(id: string, payload: UpdateContactPayload): Promise<Contact> {
  const response = await api.patch<Contact>(`/contacts/${id}`, payload);
  return response.data;
}

const contactService = { list, fieldCatalog, create, update };

export default contactService;
