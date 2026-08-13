import { DomainException } from '@veertex/domain-primitives';

export class UserNotFoundException extends DomainException {
  constructor() {
    super('Usuário não encontrado.');
  }
}

export class UserAlreadyExistsException extends DomainException {
  constructor() {
    // No e-mail echoed. This is reachable by an account admin creating a user, so it is not an
    // enumeration oracle across tenants — but there is nothing to gain by repeating the address.
    super('Já existe um usuário com este e-mail nesta conta.');
  }
}

/** Name contains "InvalidCredentials", which GlobalExceptionFilter maps to HTTP 401. */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    // ONE message for "no such e-mail" and "wrong password" alike. Two different messages would
    // tell an attacker which e-mails are registered.
    super('E-mail ou senha inválidos.');
  }
}

export class UserDisabledException extends DomainException {
  constructor() {
    // Same wording as InvalidCredentials would be ideal for opacity, but a disabled user needs to
    // know to call their admin instead of resetting a password that works fine. The trade is
    // deliberate: the state is only reachable AFTER the correct password was supplied.
    super('Usuário desativado. Fale com o administrador da sua conta.');
  }
}

/**
 * An admin disabling themselves would, if they were the last one, leave the account with no way to
 * manage users. Refused unconditionally: the operation has no legitimate use — someone else can
 * disable them.
 */
export class CannotDisableSelfException extends DomainException {
  constructor() {
    super('Você não pode desativar o próprio usuário.');
  }
}

export class LastAdministratorException extends DomainException {
  constructor() {
    super('A conta precisa de ao menos um usuário administrador ativo.');
  }
}
