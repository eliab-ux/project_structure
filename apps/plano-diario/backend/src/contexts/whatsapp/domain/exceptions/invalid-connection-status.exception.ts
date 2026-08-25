import { DomainException } from '@gitspread/domain-primitives';

export class InvalidConnectionStatusException extends DomainException {
  constructor(value: string) {
    // O valor vem do nosso banco, não do cliente — ecoar aqui é seguro e ajuda no debug.
    super(`Status de conexão inválido: ${value}`);
  }
}
