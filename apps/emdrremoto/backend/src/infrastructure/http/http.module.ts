import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../contexts/auth/auth.module';
import { PsicologoModule } from '../../contexts/psicologo/psicologo.module';
import { PacienteModule } from '../../contexts/paciente/paciente.module';
import { SessionModule } from '../../contexts/session/session.module';
import { WhatsappModule } from '../../contexts/whatsapp/whatsapp.module';
import { HealthController } from './controllers/health/health.controller';
import { AuthController } from './controllers/auth/auth.controller';
import { PsicologoController } from './controllers/psicologo/psicologo.controller';
import { PacienteController } from './controllers/paciente/paciente.controller';
import { SessionController } from './controllers/session/session.controller';
import { WhatsappController } from './controllers/whatsapp/whatsapp.controller';

/**
 * HTTP adapter: liga cada controller aos use cases exportados pelos bounded contexts.
 * Rotas públicas (health, login, cadastro, verificação por hash) estão documentadas nos
 * próprios controllers com o motivo da ausência de guard.
 */
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    PsicologoModule,
    PacienteModule,
    SessionModule,
    WhatsappModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    PsicologoController,
    PacienteController,
    SessionController,
    WhatsappController,
  ],
})
export class HttpModule {}
