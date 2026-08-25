import { DomainException } from '@gitspread/domain-primitives';

export class InvalidUserNameException extends DomainException {
  constructor(min: number, max: number) {
    super(`Nome deve ter entre ${min} e ${max} caracteres`);
  }
}
