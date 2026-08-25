import { DomainException } from '@gitspread/domain-primitives';

export class SessionNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Sessão não encontrada: ${identifier}`);
  }
}

export class SessionUnauthorizedException extends DomainException {
  constructor() {
    // O nome contém "Unauthorized" → GlobalExceptionFilter responde 401 (mensagem segura).
    super('Acesso não autorizado a esta sessão.');
  }
}
