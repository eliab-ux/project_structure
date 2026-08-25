import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  TOKEN_CRYPTO,
  TokenCryptoPort,
} from '../../../../../infrastructure/security/ports/token-crypto.port';
import {
  CONNECTION_REPOSITORY,
  ConnectionRepositoryPort,
} from '../../ports/output/connection-repository.port';

export interface GetActiveConnectionQuery {
  ownerId: string;
}

/**
 * INTERNAL use case (jobs only) — returns the tenant's decrypted access token so a per-tenant
 * job can call the Graph API on their behalf. This result NEVER crosses the HTTP boundary.
 */
export interface ActiveConnection {
  ownerId: string;
  igUserId: string;
  accessToken: string;
}

@Injectable()
export class GetActiveConnectionUseCase implements UseCase<
  GetActiveConnectionQuery,
  ActiveConnection | null
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
    @Inject(TOKEN_CRYPTO)
    private readonly tokenCrypto: TokenCryptoPort,
  ) {}

  async execute(query: GetActiveConnectionQuery): Promise<ActiveConnection | null> {
    const connection = await this.connectionRepository.findByOwner(query.ownerId);
    if (!connection || !connection.status.isConnected) {
      return null;
    }
    return {
      ownerId: connection.ownerId,
      igUserId: connection.igUserId,
      accessToken: this.tokenCrypto.decrypt(connection.accessTokenEncrypted),
    };
  }
}
