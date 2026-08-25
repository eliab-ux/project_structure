import { DomainException } from '@gitspread/domain-primitives';

export class InvalidUserRoleException extends DomainException {
  constructor(role: string) {
    // O role vem do nosso próprio banco, não do cliente — ecoar aqui é seguro e ajuda no debug.
    super(`Perfil de usuário inválido: ${role}`);
  }
}
