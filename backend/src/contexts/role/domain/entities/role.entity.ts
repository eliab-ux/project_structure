import { AggregateRoot, DomainException } from '@veertex/domain-primitives';
import { RoleId } from '../value-objects/role-id.vo';
import { PermissionSet } from '../value-objects/permission-set.vo';
import { SystemRoleImmutableException } from '../exceptions/role-exceptions';

export class InvalidRoleException extends DomainException {}

/**
 * A role of an account: a named set of permissions.
 *
 * Roles are rows OF THE ACCOUNT, not global constants, and that is a deliberate reading of
 * 01_Veertex_Core §3.3 ("papéis padrão seed… ajustáveis por conta"): a global role could not be
 * adjusted by one account without affecting every other. The seven defaults are seeded per account
 * at onboarding and marked `isSystem`, which protects their identity (code, existence) while
 * leaving their content editable.
 */
export class Role extends AggregateRoot {
  private constructor(
    private readonly _id: RoleId,
    private readonly _accountId: string,
    private readonly _code: string,
    private _name: string,
    private _description: string | null,
    private _permissions: PermissionSet,
    private readonly _isSystem: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    code: string;
    name: string;
    description?: string | null;
    permissions: PermissionSet;
    isSystem?: boolean;
    id?: RoleId;
  }): Role {
    const code = params.code.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,30}$/.test(code)) {
      throw new InvalidRoleException('Código do papel deve ter 2–30 caracteres A–Z, 0–9 ou _.');
    }
    const name = params.name.trim();
    if (name.length < 2 || name.length > 60) {
      throw new InvalidRoleException('Nome do papel deve ter entre 2 e 60 caracteres.');
    }

    return new Role(
      params.id ?? RoleId.generate(),
      params.accountId,
      code,
      name,
      params.description?.trim() || null,
      params.permissions,
      params.isSystem ?? false,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: RoleId;
    accountId: string;
    code: string;
    name: string;
    description: string | null;
    permissions: PermissionSet;
    isSystem: boolean;
    createdAt: Date;
  }): Role {
    return new Role(
      params.id,
      params.accountId,
      params.code,
      params.name,
      params.description,
      params.permissions,
      params.isSystem,
      params.createdAt,
    );
  }

  get id(): RoleId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get description(): string | null {
    return this._description;
  }

  get permissions(): PermissionSet {
    return this._permissions;
  }

  get isSystem(): boolean {
    return this._isSystem;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** True when this role can administer users and roles — the check that keeps an account unlockable. */
  get isAdministrative(): boolean {
    return this._permissions.isAdministrative;
  }

  rename(name: string, description?: string | null): void {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new InvalidRoleException('Nome do papel deve ter entre 2 e 60 caracteres.');
    }
    this._name = trimmed;
    if (description !== undefined) {
      this._description = description?.trim() || null;
    }
  }

  /** Allowed on system roles too: what a Gestor may do is the account's call, not ours. */
  changePermissions(permissions: PermissionSet): void {
    this._permissions = permissions;
  }

  assertDeletable(): void {
    if (this._isSystem) {
      throw new SystemRoleImmutableException('exclusão');
    }
  }
}
