import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidPermissionException } from '../exceptions/invalid-permission.exception';
import { grants, isKnownPermission, WILDCARD } from '../permissions.catalog';

/**
 * The permissions a role grants — validated against the catalogue at construction, so a role can
 * never hold a permission no guard will ever check.
 *
 * Stored as a sorted, de-duplicated list. Sorting is not cosmetic: the set is persisted as jsonb
 * and compared between versions in the audit trail, and an unordered list would show a diff every
 * time the UI happened to send the same permissions in a different order.
 */
export class PermissionSet extends ValueObject<{ values: readonly string[] }> {
  private constructor(props: { values: readonly string[] }) {
    super(props);
  }

  static create(permissions: readonly string[]): PermissionSet {
    const unknown = permissions.filter((permission) => !isKnownPermission(permission));
    if (unknown.length > 0) {
      throw new InvalidPermissionException(unknown);
    }

    const unique = Array.from(new Set(permissions)).sort();
    return new PermissionSet({ values: Object.freeze(unique) });
  }

  /** The set that grants everything. Reserved for the Admin role. */
  static all(): PermissionSet {
    return new PermissionSet({ values: Object.freeze([WILDCARD]) });
  }

  static empty(): PermissionSet {
    return new PermissionSet({ values: Object.freeze([]) });
  }

  get values(): readonly string[] {
    return this.props.values;
  }

  get isAdministrative(): boolean {
    return this.props.values.includes(WILDCARD);
  }

  has(permission: string): boolean {
    return grants(this.props.values, permission);
  }
}
