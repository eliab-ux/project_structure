import api from 'src/services/api';
import { AccountModule, ToggleModuleResponse } from 'src/types/auth';

async function list(): Promise<AccountModule[]> {
  const response = await api.get<AccountModule[]>('/modules');
  return response.data;
}

/**
 * Liga ou desliga um módulo.
 *
 * A resposta traz `requiresTokenRefresh`. Quem chamar precisa renovar a sessão em seguida
 * (`useAuth().refreshSession()`): os módulos efetivos viajam no token, então sem a renovação o
 * administrador que acabou de mexer no toggle continuaria vendo o menu antigo por até 15 minutos —
 * na própria tela em que fez a mudança.
 */
async function toggle(code: string, active: boolean): Promise<ToggleModuleResponse> {
  const response = await api.patch<ToggleModuleResponse>(`/modules/${code}`, { active });
  return response.data;
}

const moduleService = { list, toggle };

export default moduleService;
