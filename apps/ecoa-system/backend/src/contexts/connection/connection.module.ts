import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InstagramConnectionOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/instagram-connection-orm.entity';
import { InstagramConnectionMapper } from '../../infrastructure/persistence/mikro-orm/mappers/instagram-connection.mapper';
import { MikroOrmConnectionRepository } from '../../infrastructure/persistence/mikro-orm/repositories/connection.repository';
import { CONNECTION_REPOSITORY } from './application/ports/output/connection-repository.port';
import { GetConnectionStatusUseCase } from './application/use-cases/get-connection-status/get-connection-status.use-case';
import { GetOAuthUrlUseCase } from './application/use-cases/get-oauth-url/get-oauth-url.use-case';
import { ConnectInstagramUseCase } from './application/use-cases/connect-instagram/connect-instagram.use-case';
import { DisconnectInstagramUseCase } from './application/use-cases/disconnect-instagram/disconnect-instagram.use-case';
import { RefreshConnectionTokenUseCase } from './application/use-cases/refresh-connection-token/refresh-connection-token.use-case';
import { GetActiveConnectionUseCase } from './application/use-cases/get-active-connection/get-active-connection.use-case';
import { ListConnectedTenantsUseCase } from './application/use-cases/list-connected-tenants/list-connected-tenants.use-case';
import { ResolveOwnerByIgUserIdUseCase } from './application/use-cases/resolve-owner-by-ig-user-id/resolve-owner-by-ig-user-id.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([InstagramConnectionOrmEntity])],
  providers: [
    InstagramConnectionMapper,
    { provide: CONNECTION_REPOSITORY, useClass: MikroOrmConnectionRepository },
    GetConnectionStatusUseCase,
    GetOAuthUrlUseCase,
    ConnectInstagramUseCase,
    DisconnectInstagramUseCase,
    RefreshConnectionTokenUseCase,
    GetActiveConnectionUseCase,
    ListConnectedTenantsUseCase,
    ResolveOwnerByIgUserIdUseCase,
  ],
  exports: [
    CONNECTION_REPOSITORY,
    GetConnectionStatusUseCase,
    GetOAuthUrlUseCase,
    ConnectInstagramUseCase,
    DisconnectInstagramUseCase,
    RefreshConnectionTokenUseCase,
    GetActiveConnectionUseCase,
    ListConnectedTenantsUseCase,
    ResolveOwnerByIgUserIdUseCase,
  ],
})
export class ConnectionModule {}
