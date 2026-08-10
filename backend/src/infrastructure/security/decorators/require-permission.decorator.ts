import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';

/**
 * Declares which permissions a route needs. Enforced by `PermissionGuard`.
 *
 * Several permissions mean ALL of them are required, not any: a route that both reads and writes
 * needs both rights, and "any of these" would be the more permissive reading of an ambiguous
 * annotation — the wrong default for an authorization check.
 *
 * @example
 * @UseGuards(PermissionGuard)
 * @RequirePermission(PERMISSIONS.companies.update)
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
