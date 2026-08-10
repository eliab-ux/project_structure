import { Module } from '@nestjs/common';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh/refresh-token.use-case';
import { GetMeUseCase } from './application/use-cases/me/get-me.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password/change-password.use-case';

/**
 * TOKEN_SERVICE, PASSWORD_HASHER and TENANT_SCOPE come from the @Global SecurityModule;
 * RESET_CODE_MESSENGER from the @Global WhatsAppModule; the repositories from RepositoriesModule.
 */
@Module({
  providers: [
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
  ],
  exports: [
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
  ],
})
export class AuthModule {}
