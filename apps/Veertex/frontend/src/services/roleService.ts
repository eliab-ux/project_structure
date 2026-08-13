import api from 'src/services/api';
import {
  CreateRolePayload,
  PermissionCatalog,
  PermissionPhraseReading,
  Role,
  UpdateRolePayload,
} from 'src/types/admin';

async function list(): Promise<Role[]> {
  const response = await api.get<Role[]>('/roles');
  return response.data;
}

/**
 * O catálogo de permissões que EXISTEM — vindo do backend, nunca copiado para cá.
 *
 * Uma permissão só é real se algum guard a verifica, e guard é código do backend. Uma lista
 * duplicada no frontend ofereceria caixinhas que não concedem nada, e a divergência apareceria como
 * "marquei a permissão e o usuário continua sem acesso".
 */
async function permissionCatalog(): Promise<PermissionCatalog> {
  const response = await api.get<PermissionCatalog>('/roles/catalog');
  return response.data;
}

async function create(payload: CreateRolePayload): Promise<Role> {
  const response = await api.post<Role>('/roles', payload);
  return response.data;
}

async function update(id: string, payload: UpdateRolePayload): Promise<Role> {
  const response = await api.patch<Role>(`/roles/${id}`, payload);
  return response.data;
}

/** Papel não-sistema pode ser removido de verdade — 204, sem corpo. */
async function remove(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}

/**
 * Traduz uma frase em permissões. **Não grava nada** — devolve o plano para o humano conferir.
 *
 * `POST` com a frase no CORPO, nunca em query string: a frase descreve quem pode o quê dentro da
 * empresa do cliente, e URL entra em log de proxy e em histórico de navegador. Quem grava é o
 * `update()` acima, pela rota de sempre e com o guard de sempre.
 */
async function readPhrase(phrase: string): Promise<PermissionPhraseReading> {
  const response = await api.post<PermissionPhraseReading>('/roles/read-phrase', { phrase });
  return response.data;
}

const roleService = { list, permissionCatalog, readPhrase, create, update, remove };

export default roleService;
