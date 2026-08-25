import { AggregateRoot } from '@gitspread/domain-primitives';
import { WatchedAccountId } from '../value-objects/watched-account-id.vo';
import { Handle } from '../value-objects/handle.vo';

/**
 * A public Instagram account the tenant wants to monitor. Belongs to a single owner (tenant)
 * and is uniquely identified within that owner by its handle. Starts unresolved (igUserId null)
 * until a resolve pass maps the handle to a concrete Instagram user id.
 */
export class WatchedAccount extends AggregateRoot {
  private constructor(
    private readonly _id: WatchedAccountId,
    private readonly _ownerId: string,
    private readonly _handle: Handle,
    private _igUserId: string | null,
    private _active: boolean,
    private readonly _addedAt: Date,
  ) {
    super();
  }

  static add(ownerId: string, handle: Handle): WatchedAccount {
    return new WatchedAccount(WatchedAccountId.generate(), ownerId, handle, null, true, new Date());
  }

  static reconstitute(
    id: WatchedAccountId,
    ownerId: string,
    handle: Handle,
    igUserId: string | null,
    active: boolean,
    addedAt: Date,
  ): WatchedAccount {
    return new WatchedAccount(id, ownerId, handle, igUserId, active, addedAt);
  }

  resolve(igUserId: string): void {
    this._igUserId = igUserId;
  }

  get id(): WatchedAccountId {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get handle(): Handle {
    return this._handle;
  }
  get igUserId(): string | null {
    return this._igUserId;
  }
  get active(): boolean {
    return this._active;
  }
  get addedAt(): Date {
    return this._addedAt;
  }
}
