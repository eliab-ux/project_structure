export type UserRole = 'owner' | 'admin' | 'modelista';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Dono',
  admin: 'Administrativo',
  modelista: 'Modelista',
};

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountId: string;
  mustChangePassword: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

/**
 * Para onde cada papel vai depois de entrar (spec §8). O Modelista tem o app mobile em `/m`; o
 * Administrativo e o dono, o painel.
 *
 * O destino do painel é `/agenda` — a tela de trabalho do Administrativo — e não
 * `/configuracao`, que é exclusiva do dono (§5): mandar o `admin` para lá o jogaria numa tela que
 * ele não pode ver, e o redirecionamento de volta pareceria um bug.
 */
export function homePathFor(role: UserRole): string {
  return role === 'modelista' ? '/m' : '/agenda';
}
