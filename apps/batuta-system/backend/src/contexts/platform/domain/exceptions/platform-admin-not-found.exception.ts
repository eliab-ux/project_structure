import { DomainException } from '@gitspread/domain-primitives';

export class PlatformAdminNotFoundException extends DomainException {
  constructor() {
    super('Administrador da plataforma não encontrado.');
  }
}
