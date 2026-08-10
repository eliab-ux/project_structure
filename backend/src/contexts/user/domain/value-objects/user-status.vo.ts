export enum UserStatus {
  ACTIVE = 'ACTIVE',
  /** Cannot log in. Kept rather than deleted: their name is on orders, movements and audit rows. */
  DISABLED = 'DISABLED',
}
