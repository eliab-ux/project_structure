/**
 * Roles inside a tenant. There is no "platform" role here on purpose — platform admins live in a
 * separate table with a separate auth flow, which removes the class of bug where a null
 * `account_id` leaks data across tenants (BATUTA_SPEC §4).
 */
export enum UserRole {
  ACCOUNT_ADMIN = 'ACCOUNT_ADMIN',
  OPERATOR = 'OPERATOR',
}
