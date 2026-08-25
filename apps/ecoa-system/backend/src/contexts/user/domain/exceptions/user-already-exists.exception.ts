import { DomainException } from '@gitspread/domain-primitives';

export class UserAlreadyExistsException extends DomainException {
  constructor(email: string) {
    super(`Já existe uma conta com o e-mail: ${email}`);
  }
}
