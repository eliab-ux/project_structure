import { DomainException } from '@gitspread/domain-primitives';

export class ConnectionNotFoundException extends DomainException {
  constructor(ownerId: string) {
    super(`Nenhuma conexão do Instagram encontrada para o usuário: ${ownerId}`);
  }
}
