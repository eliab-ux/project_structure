import { ConnectionDto } from '../../../../../contexts/connection/application/dto/connection.dto';
import { GetOAuthUrlResult } from '../../../../../contexts/connection/application/use-cases/get-oauth-url/get-oauth-url.use-case';

export class ConnectionResponseDto {
  connected!: boolean;
  igUserId!: string | null;
  username!: string | null;
  status!: string | null;
  tokenExpiresAt!: Date | null;
  connectedAt!: Date | null;

  static fromDto(dto: ConnectionDto): ConnectionResponseDto {
    const res = new ConnectionResponseDto();
    res.connected = dto.connected;
    res.igUserId = dto.igUserId;
    res.username = dto.username;
    res.status = dto.status;
    res.tokenExpiresAt = dto.tokenExpiresAt;
    res.connectedAt = dto.connectedAt;
    return res;
  }
}

export class OAuthUrlResponseDto {
  url!: string;
  state!: string;

  static fromResult(result: GetOAuthUrlResult): OAuthUrlResponseDto {
    const res = new OAuthUrlResponseDto();
    res.url = result.url;
    res.state = result.state;
    return res;
  }
}
