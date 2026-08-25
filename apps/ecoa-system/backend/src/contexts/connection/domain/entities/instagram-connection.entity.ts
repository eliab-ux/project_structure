import { AggregateRoot } from '@gitspread/domain-primitives';
import { ConnectionId } from '../value-objects/connection-id.vo';
import { ConnectionStatus } from '../value-objects/connection-status.vo';
import { ConnectionEstablishedEvent } from '../events/connection-established.event';

/**
 * The tenant's link to their own Instagram account. It is a separate, revocable connection —
 * never the login. `accessToken` is held here ONLY as an already-encrypted, opaque blob;
 * the domain never sees the plaintext token (encryption is an infrastructure concern).
 */
export class InstagramConnection extends AggregateRoot {
  private constructor(
    private readonly _id: ConnectionId,
    private readonly _ownerId: string,
    private _igUserId: string,
    private _username: string,
    private _accessTokenEncrypted: string,
    private _tokenExpiresAt: Date | null,
    private _status: ConnectionStatus,
    private _connectedAt: Date,
  ) {
    super();
  }

  static establish(
    ownerId: string,
    igUserId: string,
    username: string,
    accessTokenEncrypted: string,
    tokenExpiresAt: Date | null,
  ): InstagramConnection {
    const connection = new InstagramConnection(
      ConnectionId.generate(),
      ownerId,
      igUserId,
      username,
      accessTokenEncrypted,
      tokenExpiresAt,
      ConnectionStatus.CONNECTED,
      new Date(),
    );
    connection.addDomainEvent(
      new ConnectionEstablishedEvent(connection._id.value, ownerId, igUserId, username),
    );
    return connection;
  }

  static reconstitute(
    id: ConnectionId,
    ownerId: string,
    igUserId: string,
    username: string,
    accessTokenEncrypted: string,
    tokenExpiresAt: Date | null,
    status: ConnectionStatus,
    connectedAt: Date,
  ): InstagramConnection {
    return new InstagramConnection(
      id,
      ownerId,
      igUserId,
      username,
      accessTokenEncrypted,
      tokenExpiresAt,
      status,
      connectedAt,
    );
  }

  /** Same tenant re-runs the OAuth flow (possibly for a different IG account). */
  reconnect(
    igUserId: string,
    username: string,
    accessTokenEncrypted: string,
    tokenExpiresAt: Date | null,
  ): void {
    this._igUserId = igUserId;
    this._username = username;
    this._accessTokenEncrypted = accessTokenEncrypted;
    this._tokenExpiresAt = tokenExpiresAt;
    this._status = ConnectionStatus.CONNECTED;
    this._connectedAt = new Date();
    this.addDomainEvent(
      new ConnectionEstablishedEvent(this._id.value, this._ownerId, igUserId, username),
    );
  }

  /** Token successfully refreshed by the scheduled job. */
  updateToken(accessTokenEncrypted: string, tokenExpiresAt: Date | null): void {
    this._accessTokenEncrypted = accessTokenEncrypted;
    this._tokenExpiresAt = tokenExpiresAt;
    this._status = ConnectionStatus.CONNECTED;
  }

  markExpired(): void {
    this._status = ConnectionStatus.EXPIRED;
  }

  get id(): ConnectionId {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get igUserId(): string {
    return this._igUserId;
  }
  get username(): string {
    return this._username;
  }
  /** Opaque, already-encrypted token. Never logged, never returned over HTTP. */
  get accessTokenEncrypted(): string {
    return this._accessTokenEncrypted;
  }
  get tokenExpiresAt(): Date | null {
    return this._tokenExpiresAt;
  }
  get status(): ConnectionStatus {
    return this._status;
  }
  get connectedAt(): Date {
    return this._connectedAt;
  }
}
