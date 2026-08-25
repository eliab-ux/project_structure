import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { ResellerModule } from '../reseller/reseller.module';
import { LoginUserUseCase } from './application/use-cases/login/login-user.use-case';
import { LoginAdminUseCase } from './application/use-cases/login-admin/login-admin.use-case';
import { RefreshTokenUseCase } from './application/use-cases/login/refresh-token.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
import { SyncUsersToSupabaseUseCase } from './application/use-cases/sync-users-to-supabase/sync-users-to-supabase.use-case';
import { GetMeUseCase } from './application/use-cases/me/get-me.use-case';

@Module({
  imports: [UserModule, ResellerModule],
  providers: [
    LoginUserUseCase,
    LoginAdminUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    SyncUsersToSupabaseUseCase,
    GetMeUseCase,
  ],
  exports: [
    LoginUserUseCase,
    LoginAdminUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    SyncUsersToSupabaseUseCase,
    GetMeUseCase,
  ],
})
export class AuthenticationModule {}
