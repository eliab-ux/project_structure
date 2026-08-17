import { DomainException } from '@gitspread/domain-primitives';

/** Vira 403 no GlobalExceptionFilter (o nome casa com /Forbidden/). */
export class ForbiddenRoleAssignmentException extends DomainException {
  constructor() {
    // Spec §5: criar usuário de papel `owner` é exclusivo do `owner`. O `admin` cria e edita
    // `modelista` e `admin` — se pudesse criar um `owner`, ele se promoveria por triangulação.
    super('Somente o dono pode criar ou promover um usuário a dono.');
  }
}
