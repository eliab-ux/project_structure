import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WhatsappInstanceOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/whatsapp-instance-orm.entity';
import { WhatsappInstanceMapper } from '../../infrastructure/persistence/mikro-orm/mappers/whatsapp-instance.mapper';
import { MikroOrmWhatsappInstanceRepository } from '../../infrastructure/persistence/mikro-orm/repositories/whatsapp-instance.repository';
import { EvolutionGateway } from '../../infrastructure/external/whatsapp/evolution.gateway';
import { WHATSAPP_INSTANCE_REPOSITORY } from './application/ports/output/whatsapp-instance-repository.port';
import { EVOLUTION_GATEWAY } from './application/ports/output/evolution-gateway.port';
import { SetupWhatsappUseCase } from './application/use-cases/setup-whatsapp/setup-whatsapp.use-case';
import { GetWhatsappStatusUseCase } from './application/use-cases/get-whatsapp-status/get-whatsapp-status.use-case';
import { DisconnectWhatsappUseCase } from './application/use-cases/disconnect-whatsapp/disconnect-whatsapp.use-case';
import { SendWhatsappUseCase } from './application/use-cases/send-whatsapp/send-whatsapp.use-case';

@Module({
  imports: [ConfigModule, MikroOrmModule.forFeature([WhatsappInstanceOrmEntity])],
  providers: [
    WhatsappInstanceMapper,
    { provide: WHATSAPP_INSTANCE_REPOSITORY, useClass: MikroOrmWhatsappInstanceRepository },
    { provide: EVOLUTION_GATEWAY, useClass: EvolutionGateway },
    SetupWhatsappUseCase,
    GetWhatsappStatusUseCase,
    DisconnectWhatsappUseCase,
    SendWhatsappUseCase,
  ],
  exports: [
    SetupWhatsappUseCase,
    GetWhatsappStatusUseCase,
    DisconnectWhatsappUseCase,
    SendWhatsappUseCase,
  ],
})
export class WhatsappModule {}
