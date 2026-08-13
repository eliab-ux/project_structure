import { randomUUID } from 'crypto';
import { DomainException, ValueObject } from '@veertex/domain-primitives';

export class InvalidIdException extends DomainException {
  constructor(entity: string) {
    super(`Identificador de ${entity} inválido.`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Base for every entity identifier. Subclasses exist so that a `CompanyId` cannot be passed where a
 * `UserId` is expected — with bare strings that mistake compiles, and the query silently returns
 * nothing.
 *
 * Ids are generated in the APPLICATION, not by the database, and that is load-bearing here: the
 * onboarding transaction inserts an account, its companies, roles and admin user in one go, and
 * each of those needs the parent's id before any of them is flushed.
 *
 * Subclasses only supply their entity name for the error message:
 *
 *     export class UserId extends UuidId {
 *       protected static entityName = 'usuário';
 *     }
 */
export abstract class UuidId extends ValueObject<{ value: string }> {
  protected constructor(props: { value: string }) {
    super(props);
  }

  static generate<T extends UuidId>(this: new (props: { value: string }) => T): T {
    return new this({ value: randomUUID() });
  }

  static from<T extends UuidId>(
    this: (new (props: { value: string }) => T) & { entityName: string },
    value: string,
  ): T {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!UUID.test(normalized)) {
      throw new InvalidIdException(this.entityName);
    }
    return new this({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
