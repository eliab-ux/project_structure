import { DomainException } from '@veertex/domain-primitives';

export class CompanyNotFoundException extends DomainException {
  constructor() {
    super('Empresa não encontrada.');
  }
}

/**
 * Two companies of the same account cannot share a CNPJ. Enforced here for the message and by a
 * unique index for the guarantee — the check-then-insert race is real, and only the index closes it.
 */
export class DuplicateCompanyDocumentException extends DomainException {
  constructor() {
    super('Já existe uma empresa com este CNPJ nesta conta.');
  }
}

/**
 * Deactivating the last active company would leave the account unable to sell, invoice or move
 * stock — every one of those needs a company. Refused with an explanation rather than allowed and
 * discovered later at the first order.
 */
export class LastActiveCompanyException extends DomainException {
  constructor() {
    super('Não é possível desativar a única empresa ativa da conta.');
  }
}

/**
 * A company that is exempt from state registration must not also carry a number, and one that is
 * not exempt must have one. Contradictory fiscal data fails at the SEFAZ, far from here.
 */
export class InconsistentStateRegistrationException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
