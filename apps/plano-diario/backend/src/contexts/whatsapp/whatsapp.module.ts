import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { WhatsappGroupOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/whatsapp-group-orm.entity';
import { WhatsappInstanceOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/whatsapp-instance-orm.entity';
import { WhatsappGroupMapper } from '../../infrastructure/persistence/mikro-orm/mappers/whatsapp-group.mapper';
import { WhatsappInstanceMapper } from '../../infrastructure/persistence/mikro-orm/mappers/whatsapp-instance.mapper';
import { MikroOrmWhatsappGroupRepository } from '../../infrastructure/persistence/mikro-orm/repositories/whatsapp-group.repository';
import { MikroOrmWhatsappInstanceRepository } from '../../infrastructure/persistence/mikro-orm/repositories/whatsapp-instance.repository';
import { EvolutionApiAdapter } from '../../infrastructure/whatsapp/evolution-api.adapter';
import { WHATSAPP_GATEWAY } from './application/ports/output/whatsapp-gateway.port';
import { WHATSAPP_GROUP_REPOSITORY } from './application/ports/output/whatsapp-group-repository.port';
import { WHATSAPP_INSTANCE_REPOSITORY } from './application/ports/output/whatsapp-instance-repository.port';
import { ConnectWhatsappUseCase } from './application/use-cases/connect-whatsapp/connect-whatsapp.use-case';
import { DeleteInstanceUseCase } from './application/use-cases/delete-instance/delete-instance.use-case';
import { DisconnectWhatsappUseCase } from './application/use-cases/disconnect-whatsapp/disconnect-whatsapp.use-case';
import { GetConnectionStateUseCase } from './application/use-cases/get-connection-state/get-connection-state.use-case';
import { ListGroupsUseCase } from './application/use-cases/list-groups/list-groups.use-case';
import { SyncGroupsUseCase } from './application/use-cases/sync-groups/sync-groups.use-case';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([WhatsappInstanceOrmEntity, WhatsappGroupOrmEntity]),
  ],
  providers: [
    WhatsappInstanceMapper,
    WhatsappGroupMapper,
    { provide: WHATSAPP_INSTANCE_REPOSITORY, useClass: MikroOrmWhatsappInstanceRepository },
    { provide: WHATSAPP_GROUP_REPOSITORY, useClass: MikroOrmWhatsappGroupRepository },
    { provide: WHATSAPP_GATEWAY, useClass: EvolutionApiAdapter },
    ConnectWhatsappUseCase,
    GetConnectionStateUseCase,
    DisconnectWhatsappUseCase,
    DeleteInstanceUseCase,
    SyncGroupsUseCase,
    ListGroupsUseCase,
  ],
  exports: [
    WHATSAPP_INSTANCE_REPOSITORY,
    WHATSAPP_GROUP_REPOSITORY,
    WHATSAPP_GATEWAY,
    ConnectWhatsappUseCase,
    GetConnectionStateUseCase,
    DisconnectWhatsappUseCase,
    DeleteInstanceUseCase,
    SyncGroupsUseCase,
    ListGroupsUseCase,
  ],
})
export class WhatsappModule {}
