import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PasswordResetCodeOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/password-reset-code-orm.entity';
import { PasswordResetCodeMapper } from '../../infrastructure/persistence/mikro-orm/mappers/password-reset-code.mapper';
import { MikroOrmPasswordResetCodeRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-password-reset-code.repository';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { WhatsAppModule } from '../../infrastructure/whatsapp/whatsapp.module';
import { UserModule } from '../user/user.module';
import { PASSWORD_RESET_CODE_REPOSITORY } from './application/ports/output/password-reset-code-repository.port';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token/refresh-token.use-case';
import { GetMeUseCase } from './application/use-cases/get-me/get-me.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password/change-password.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';

@Module({
  imports: [
    MikroOrmModule.forFeature([PasswordResetCodeOrmEntity]),
    // UserModule exporta USER_REPOSITORY; SecurityModule, TOKEN_SERVICE e PASSWORD_HASHER;
    // WhatsAppModule, PASSWORD_RESET_NOTIFIER.
    UserModule,
    SecurityModule,
    WhatsAppModule,
  ],
  providers: [
    PasswordResetCodeMapper,
    { provide: PASSWORD_RESET_CODE_REPOSITORY, useClass: MikroOrmPasswordResetCodeRepository },
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    ChangePasswordUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
  exports: [
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    ChangePasswordUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
})
export class AuthModule {}
