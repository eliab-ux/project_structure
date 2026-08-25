import { User } from '../../../domain/entities/user.entity';
import { Email } from '../../../domain/value-objects/email.vo';
import { UserId } from '../../../domain/value-objects/user-id.vo';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort {
  /** Tenant-scoped by the global filter — a user of another account simply does not exist. */
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  listByAccount(): Promise<User[]>;
  save(user: User): Promise<User>;

  /**
   * THE ONLY unscoped read of users, and the reason it exists: on the anonymous paths there is no
   * JWT yet, so there is no tenant to scope by — the e-mail is what identifies the user.
   *
   * Callable from exactly three places, all of them public endpoints where the caller cannot
   * possibly hold a token: `login`, `request-password-reset` and `reset-password`. Everything
   * downstream scopes by the accountId found on the returned user. Never call it from an
   * authenticated path — those have a tenant, and using this would bypass it.
   */
  findByEmailForAuthentication(email: Email): Promise<User | null>;
}
