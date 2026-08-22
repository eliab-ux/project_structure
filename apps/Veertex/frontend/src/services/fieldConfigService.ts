import api from 'src/services/api';
import { EntityFieldConfig, FieldOverride } from 'src/types/fieldConfig';

async function entities(): Promise<string[]> {
  const response = await api.get<{ entities: string[] }>('/field-config/entities');
  return response.data.entities;
}

async function get(entity: string): Promise<EntityFieldConfig> {
  const response = await api.get<EntityFieldConfig>(`/field-config/${entity}`);
  return response.data;
}

async function set(entity: string, overrides: FieldOverride[]): Promise<EntityFieldConfig> {
  const response = await api.put<EntityFieldConfig>(`/field-config/${entity}`, { overrides });
  return response.data;
}

const fieldConfigService = { entities, get, set };

export default fieldConfigService;
