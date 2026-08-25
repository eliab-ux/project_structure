import { InstagramConnection } from '../../domain/entities/instagram-connection.entity';

/**
 * Application-boundary view of a connection. NEVER carries the access token (encrypted or not).
 * `connected` lets the UI render the empty/expired state without leaking internals.
 */
export class ConnectionDto {
  connected!: boolean;
  igUserId!: string | null;
  username!: string | null;
  status!: string | null;
  tokenExpiresAt!: Date | null;
  connectedAt!: Date | null;

  static fromDomain(connection: InstagramConnection | null): ConnectionDto {
    const dto = new ConnectionDto();
    if (!connection) {
      dto.connected = false;
      dto.igUserId = null;
      dto.username = null;
      dto.status = null;
      dto.tokenExpiresAt = null;
      dto.connectedAt = null;
      return dto;
    }
    dto.connected = connection.status.isConnected;
    dto.igUserId = connection.igUserId;
    dto.username = connection.username;
    dto.status = connection.status.value;
    dto.tokenExpiresAt = connection.tokenExpiresAt;
    dto.connectedAt = connection.connectedAt;
    // accessTokenEncrypted is intentionally never mapped.
    return dto;
  }
}
