import { WatchedAccount } from '../../../domain/entities/watched-account.entity';

export const WATCHLIST_REPOSITORY = Symbol('WATCHLIST_REPOSITORY');

export interface WatchlistRepositoryPort {
  save(account: WatchedAccount): Promise<WatchedAccount>;
  findByOwner(ownerId: string): Promise<WatchedAccount[]>;
  findById(ownerId: string, id: string): Promise<WatchedAccount | null>;
  delete(ownerId: string, id: string): Promise<void>;
  findByOwnerAndHandle(ownerId: string, handle: string): Promise<WatchedAccount | null>;
  /** Accounts still missing their ig_user_id and still active — the resolve pass targets. */
  findUnresolvedByOwner(ownerId: string): Promise<WatchedAccount[]>;
  /** Matches by handle == lowercased username; used by the mention webhook to attribute a reshare. */
  findByOwnerAndSourceUsername(ownerId: string, username: string): Promise<WatchedAccount | null>;
}
