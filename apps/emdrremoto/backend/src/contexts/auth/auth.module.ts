import { Module } from '@nestjs/common';
import { PsicologoModule } from '../psicologo/psicologo.module';
import { PacienteModule } from '../paciente/paciente.module';
import { LoginPsicologoUseCase } from './application/use-cases/login-psicologo/login-psicologo.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
import { PacienteSessionAccessUseCase } from './application/use-cases/paciente-session-access/paciente-session-access.use-case';
import { GetMeUseCase } from './application/use-cases/get-me/get-me.use-case';

/**
 * Auth próprio (JWT do backend). Depende dos repositórios de psicologo/paciente (ports)
 * e dos serviços de SecurityModule (global): TOKEN_SERVICE, PASSWORD_HASHER.
 */
@Module({
  imports: [PsicologoModule, PacienteModule],
  providers: [
    LoginPsicologoUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    PacienteSessionAccessUseCase,
    GetMeUseCase,
  ],
  exports: [
    LoginPsicologoUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    PacienteSessionAccessUseCase,
    GetMeUseCase,
  ],
})
export class AuthModule {}
