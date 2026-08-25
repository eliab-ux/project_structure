import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  TOKEN_CRYPTO,
  TokenCryptoPort,
} from '../../../../../infrastructure/security/ports/token-crypto.port';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../../../../infrastructure/integrations/instagram/ports/instagram-gateway.port';
import {
  CONNECTION_REPOSITORY,
  ConnectionRepositoryPort,
} from '../../ports/output/connection-repository.port';

export interface RefreshConnectionTokenCommand {
  ownerId: string;
}

export interface RefreshConnectionTokenResult {
  status: 'refreshed' | 'expired' | 'skipped';
}

/**
 * Renews a tenant's long-lived token before it expires (run by the `refresh-token` job). On
 * failure the connection is marked `expired` so the UI can prompt a reconnect — the tenant is
 * never locked out. Tokens are only ever handled in memory here; never logged.
 */
@Injectable()
export class RefreshConnectionTokenUseCase implements UseCase<
  RefreshConnectionTokenCommand,
  RefreshConnectionTokenResult
> {
  private readonly logger = new Logger(RefreshConnectionTokenUseCase.name);

  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
    @Inject(INSTAGRAM_GATEWAY)
    private readonly gateway: InstagramGatewayPort,
    @Inject(TOKEN_CRYPTO)
    private readonly tokenCrypto: TokenCryptoPort,
    @Inject(UNIT_OF_WORK)
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RefreshConnectionTokenCommand): Promise<RefreshConnectionTokenResult> {
    const connection = await this.connectionRepository.findByOwner(command.ownerId);
    if (!connection || !connection.status.isConnected) {
      return { status: 'skipped' };
    }

    try {
      const current = this.tokenCrypto.decrypt(connection.accessTokenEncrypted);
      const refreshed = await this.gateway.refreshLongLivedToken(current);
      connection.updateToken(this.tokenCrypto.encrypt(refreshed.accessToken), refreshed.expiresAt);
      await this.uow.execute(async () => {
        await this.connectionRepository.save(connection);
      });
      return { status: 'refreshed' };
    } catch (error) {
      this.logger.warn('Falha ao renovar token do Instagram; marcando conexão como expirada', {
        ownerId: command.ownerId,
        reason: (error as Error)?.message,
      });
      connection.markExpired();
      await this.uow.execute(async () => {
        await this.connectionRepository.save(connection);
      });
      return { status: 'expired' };
    }
  }
}
