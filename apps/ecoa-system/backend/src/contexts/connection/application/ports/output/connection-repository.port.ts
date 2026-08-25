import { InstagramConnection } from '../../../domain/entities/instagram-connection.entity';

export const CONNECTION_REPOSITORY = Symbol('CONNECTION_REPOSITORY');

export interface ConnectionRepositoryPort {
  /** The tenant's single connection (owner-scoped). */
  findByOwner(ownerId: string): Promise<InstagramConnection | null>;

  /**
   * Global lookup by ig_user_id — used to (a) enforce the unique-global rule on connect and
   * (b) resolve the tenant when a webhook event arrives. NOT owner-scoped by design.
   */
  findByIgUserId(igUserId: string): Promise<InstagramConnection | null>;

  /** All currently connected accounts — the scheduler fans out one job per entry. */
  findAllConnected(): Promise<InstagramConnection[]>;

  save(connection: InstagramConnection): Promise<InstagramConnection>;

  delete(ownerId: string): Promise<void>;
}
