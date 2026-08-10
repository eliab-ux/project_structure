/**
 * The catalogue of permissions that EXIST. Fixed in code, never in the database.
 *
 * The same reasoning as `field_config` (01_Veertex_Core §3.6): the account configures what it
 * *grants*, never what *exists*. A permission is only real if some guard checks it, and a guard is
 * code — so a database row inventing `contacts.super_edit` would grant nothing and mislead whoever
 * ticked it. Validating a role against this list at write time is what keeps the two in step.
 *
 * Naming: `<area>.<action>` with optional sub-scoping (`contacts.credit_limit.edit`). Read,
 * create/update and delete are separate on purpose — 01 §3.3 asks for that separation explicitly,
 * because "can see the customer" and "can delete the customer" are not the same job.
 *
 * ⚠️ F1 covers CORE only. Each later module adds its own block here, and the default roles below
 * gain the permissions of the module when that module lands — a Representante has almost nothing
 * to do until ROT exists, and inventing permissions now would be a silent default (§9.2).
 */
export const PERMISSIONS = {
  account: {
    read: 'account.read',
    update: 'account.update',
  },
  companies: {
    read: 'companies.read',
    create: 'companies.create',
    update: 'companies.update',
    delete: 'companies.delete',
  },
  users: {
    read: 'users.read',
    create: 'users.create',
    update: 'users.update',
    disable: 'users.disable',
  },
  roles: {
    read: 'roles.read',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
} as const;

/** Grants everything, present and future. Only the Admin role should hold it. */
export const WILDCARD = '*';

/** Flat list of every valid permission string — the whitelist a role is validated against. */
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS).flatMap((area) =>
  Object.values(area),
);

/** The areas that exist, for the UI to render the permission tree by group. */
export const PERMISSION_AREAS = Object.keys(PERMISSIONS);

/**
 * Whether a set of granted permissions satisfies a required one.
 *
 * Accepts three shapes of grant: the exact permission, an area wildcard (`companies.*`) and the
 * global wildcard (`*`). Prefix wildcards are resolved segment by segment so that
 * `contacts.credit_limit.*` grants `contacts.credit_limit.edit` but NOT `contacts.delete` — a
 * naive `startsWith` would have granted both, which is how a wildcard quietly becomes an escalation.
 *
 * Pure function, no framework: used by the domain (PermissionSet) and by the HTTP guard alike.
 */
export function grants(granted: readonly string[], required: string): boolean {
  if (granted.includes(WILDCARD) || granted.includes(required)) {
    return true;
  }

  const segments = required.split('.');
  // `a.b.c` → check `a.*`, then `a.b.*`. The full `a.b.c.*` is meaningless and not generated.
  for (let i = 1; i < segments.length; i += 1) {
    if (granted.includes(`${segments.slice(0, i).join('.')}.${WILDCARD}`)) {
      return true;
    }
  }
  return false;
}

/** True when the string is a permission this build knows about, or a well-formed wildcard. */
export function isKnownPermission(permission: string): boolean {
  if (permission === WILDCARD) {
    return true;
  }
  if (permission.endsWith(`.${WILDCARD}`)) {
    const prefix = permission.slice(0, -2);
    return ALL_PERMISSIONS.some((known) => known === prefix || known.startsWith(`${prefix}.`));
  }
  return ALL_PERMISSIONS.includes(permission);
}
