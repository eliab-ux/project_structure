import { Inject, Injectable } from '@nestjs/common';
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
import { InstagramConnection } from '../../../domain/entities/instagram-connection.entity';
import { InstagramAlreadyConnectedException } from '../../../domain/exceptions/instagram-already-connected.exception';
import { ConnectionDto } from '../../dto/connection.dto';

export class ConnectInstagramCommand {
  constructor(
    public readonly ownerId: string,
    public readonly code: string,
  ) {}
}

/**
 * Exchanges the OAuth `code` for a long-lived token, enforces the unique-global rule on
 * ig_user_id, encrypts the token at rest and persists the tenant's connection. The plaintext
 * token exists only in memory for the duration of this call and is never logged.
 */
@Injectable()
export class ConnectInstagramUseCase implements UseCase<ConnectInstagramCommand, ConnectionDto> {
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

  async execute(command: ConnectInstagramCommand): Promise<ConnectionDto> {
    const result = await this.gateway.exchangeCodeForToken(command.code);

    // Unique-global rule: an ig_user_id already linked to a DIFFERENT tenant is rejected.
    const existingByIg = await this.connectionRepository.findByIgUserId(result.igUserId);
    if (existingByIg && existingByIg.ownerId !== command.ownerId) {
      throw new InstagramAlreadyConnectedException();
    }

    const encrypted = this.tokenCrypto.encrypt(result.accessToken);

    // Upsert the tenant's single connection (reconnect keeps the same row/owner scope).
    const existing = await this.connectionRepository.findByOwner(command.ownerId);
    const connection =
      existing ??
      InstagramConnection.establish(
        command.ownerId,
        result.igUserId,
        result.username,
        encrypted,
        result.expiresAt,
      );
    if (existing) {
      existing.reconnect(result.igUserId, result.username, encrypted, result.expiresAt);
    }

    return this.uow.execute(async () => {
      const saved = await this.connectionRepository.save(connection);
      return ConnectionDto.fromDomain(saved);
    });
  }
}
