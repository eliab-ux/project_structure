import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SessionOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/session-orm.entity';
import { SessionMapper } from '../../infrastructure/persistence/mikro-orm/mappers/session.mapper';
import { MikroOrmSessionRepository } from '../../infrastructure/persistence/mikro-orm/repositories/session.repository';
import { DailyCoVideoGateway } from '../../infrastructure/external/video/daily-co-video.gateway';
import { PacienteModule } from '../paciente/paciente.module';
import { PsicologoModule } from '../psicologo/psicologo.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SESSION_REPOSITORY } from './application/ports/output/session-repository.port';
import { VIDEO_GATEWAY } from './application/ports/output/video-gateway.port';
import { CreateSessionUseCase } from './application/use-cases/create-session/create-session.use-case';
import { GetSessionByCodeUseCase } from './application/use-cases/get-session-by-code/get-session-by-code.use-case';
import { AssertSessionMembershipUseCase } from './application/use-cases/assert-session-membership/assert-session-membership.use-case';
import { RecordEntryUseCase } from './application/use-cases/record-entry/record-entry.use-case';
import { EndSessionUseCase } from './application/use-cases/end-session/end-session.use-case';
import { GetSessionInviteUseCase } from './application/use-cases/get-session-invite/get-session-invite.use-case';
import { GetSessionInfoUseCase } from './application/use-cases/get-session-info/get-session-info.use-case';
import { SendSessionLinkUseCase } from './application/use-cases/send-session-link/send-session-link.use-case';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([SessionOrmEntity]),
    PacienteModule,
    PsicologoModule,
    WhatsappModule,
  ],
  providers: [
    SessionMapper,
    { provide: SESSION_REPOSITORY, useClass: MikroOrmSessionRepository },
    { provide: VIDEO_GATEWAY, useClass: DailyCoVideoGateway },
    CreateSessionUseCase,
    GetSessionByCodeUseCase,
    AssertSessionMembershipUseCase,
    RecordEntryUseCase,
    EndSessionUseCase,
    GetSessionInviteUseCase,
    GetSessionInfoUseCase,
    SendSessionLinkUseCase,
  ],
  exports: [
    SESSION_REPOSITORY,
    VIDEO_GATEWAY,
    CreateSessionUseCase,
    GetSessionByCodeUseCase,
    AssertSessionMembershipUseCase,
    RecordEntryUseCase,
    EndSessionUseCase,
    GetSessionInviteUseCase,
    GetSessionInfoUseCase,
    SendSessionLinkUseCase,
  ],
})
export class SessionModule {}
