import { DomainException } from '@gitspread/domain-primitives';

export class RoleNotFoundException extends DomainException {
  constructor() {
    super('Papel não encontrado.');
  }
}

export class DuplicateRoleCodeException extends DomainException {
  constructor(code: string) {
    super(`Já existe um papel com o código "${code}" nesta conta.`);
  }
}

/**
 * The seeded roles can be RENAMED and have their permissions adjusted (01 §3.3: "ajustáveis por
 * conta"), but not deleted and not have their code changed — users reference them, and the CLI and
 * onboarding look the admin role up by code.
 */
export class SystemRoleImmutableException extends DomainException {
  constructor(what: 'exclusão' | 'código') {
    super(`Papel padrão do sistema não permite ${what}.`);
  }
}

/** Deleting a role that users still hold would leave them with no permissions at all. */
export class RoleInUseException extends DomainException {
  constructor(userCount: number) {
    super(
      `Este papel está atribuído a ${userCount} usuário(s). Mova-os para outro papel antes de excluir.`,
    );
  }
}

/**
 * An account must keep at least one role that can administer it. Removing the last administrative
 * role locks every user out of user and role management — a state only a database edit could undo.
 */
export class LastAdministrativeRoleException extends DomainException {
  constructor() {
    super('A conta precisa de ao menos um papel com permissão total de administração.');
  }
}
