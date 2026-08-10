import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import { User } from '../../../domain/entities/user.entity';
import { UserId } from '../../../domain/value-objects/user-id.vo';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** What the cross-tenant authentication lookup returns: a user plus the tenant it belongs to. */
export interface AuthenticationLookupResult {
  user: User;
  accountId: string;
}

export interface UserRepositoryPort {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  listAll(): Promise<User[]>;
  countAll(): Promise<number>;
  countByRole(roleId: RoleId): Promise<number>;
  /** Active users whose role grants full administration — guards the "last admin" rule. */
  countActiveAdministrators(): Promise<number>;
  save(user: User): Promise<User>;

  /**
   * THE authentication lookup, and the ONLY cross-tenant read in the runtime path.
   *
   * At login there is no JWT, so there is no tenant scope, so RLS would return nothing — the e-mail
   * is the only identifier available. It is served by a `security definer` function owned by the
   * schema owner (`veertex_auth_find_user_by_email`), which is what lets exactly this one query,
   * with a fixed shape and a fixed column list, cross the boundary. Everything downstream scopes
   * itself by the accountId this returns.
   *
   * The function is created by the F1 migration (`Migration20260808120000`), alongside the RLS
   * policies it exists to complement, and its EXECUTE grant is revoked from PUBLIC there.
   */
  findForAuthentication(email: Email): Promise<AuthenticationLookupResult | null>;
}
