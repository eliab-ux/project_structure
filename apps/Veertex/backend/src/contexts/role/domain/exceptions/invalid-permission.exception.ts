import { DomainException } from '@veertex/domain-primitives';

export class InvalidPermissionException extends DomainException {
  constructor(unknown: readonly string[]) {
    // Safe to echo: these are permission identifiers the caller just sent, not user data. Naming
    // them is the whole value of the message — "permissão inválida" alone forces a guessing game.
    super(`Permissão desconhecida: ${unknown.join(', ')}.`);
  }
}
