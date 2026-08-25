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

export interface ResolveOwnerByIgUserIdQuery {
  igUserId: string;
}

/**
 * INTERNAL use case (webhook processor only). Meta delivers events for ALL tenants to a single
 * endpoint; this resolves `payload.ig_user_id` → the owning tenant. An event whose ig_user_id
 * matches no connection returns null and is discarded upstream.
 */
export interface ResolvedOwner {
  ownerId: string;
  igUserId: string;
  accessToken: string;
}

@Injectable()
export class ResolveOwnerByIgUserIdUseCase implements UseCase<
  ResolveOwnerByIgUserIdQuery,
  ResolvedOwner | null
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
    @Inject(TOKEN_CRYPTO)
    private readonly tokenCrypto: TokenCryptoPort,
  ) {}

  async execute(query: ResolveOwnerByIgUserIdQuery): Promise<ResolvedOwner | null> {
    const connection = await this.connectionRepository.findByIgUserId(query.igUserId);
    if (!connection) {
      return null;
    }
    return {
      ownerId: connection.ownerId,
      igUserId: connection.igUserId,
      accessToken: this.tokenCrypto.decrypt(connection.accessTokenEncrypted),
    };
  }
}
