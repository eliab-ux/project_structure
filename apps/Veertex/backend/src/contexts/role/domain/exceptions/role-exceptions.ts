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
 * A conta tem de manter ao menos um usuário ATIVO capaz de administrar papéis (`roles.update`).
 *
 * A mensagem diz o que fazer, e não só o que foi recusado: quem esbarra nesta trava normalmente está
 * no meio de uma reorganização de permissões e precisa saber qual é a ordem certa das operações.
 *
 * Substitui `LastAdministrativeRoleException` e `LastAdministratorException`, que contavam quem tem
 * o curinga `*` — deixando de fora um papel com `roles.update` explícito. Ver
 * `RoleAdministrationPolicy` para o buraco que isso abria.
 */
export class AccountWouldLoseRoleAdministrationException extends DomainException {
  constructor() {
    super(
      'Esta alteração deixaria a conta sem nenhum usuário ativo capaz de administrar papéis, e ' +
        'não haveria como devolver a permissão a ninguém depois. Garanta que outro usuário ativo ' +
        'tenha um papel com permissão de editar papéis antes de aplicar esta mudança.',
    );
  }
}
