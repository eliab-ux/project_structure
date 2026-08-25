import { DomainException } from '@gitspread/domain-primitives';

export class InvalidPlatformAdminIdException extends DomainException {
  constructor() {
    super('Identificador de administrador da plataforma inválido.');
  }
}
