import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MAIL_SENDER } from './application/ports/output/mail-sender.port';
import { PASSWORD_RESET_CODE_REPOSITORY } from './application/ports/output/password-reset-code-repository.port';
import { RESET_CODE_MESSENGER } from './application/ports/output/reset-code-messenger.port';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh/refresh-token.use-case';
import { GetMeUseCase } from './application/use-cases/me/get-me.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';
import { AccountModule } from '../account/account.module';
import { UserModule } from '../user/user.module';
import { PasswordResetCodeOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/password-reset-code-orm.entity';
import { MikroOrmPasswordResetCodeRepository } from '../../infrastructure/persistence/mikro-orm/repositories/password-reset-code.repository';
import { EvolutionResetCodeMessenger } from '../../infrastructure/notifications/evolution-reset-code-messenger.adapter';
import { NodemailerMailSender } from '../../infrastructure/mail/nodemailer-mail-sender.service';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([PasswordResetCodeOrmEntity]),
    AccountModule,
    UserModule,
  ],
  providers: [
    { provide: PASSWORD_RESET_CODE_REPOSITORY, useClass: MikroOrmPasswordResetCodeRepository },
    // The recovery channel is the PLATFORM's WhatsApp instance, never a tenant chip — see the port.
    { provide: RESET_CODE_MESSENGER, useClass: EvolutionResetCodeMessenger },
    // MAIL_SENDER stays: it is no longer used by the reset flow, but the approval notifier
    // (SystemNotifierAdapter) sends the magic link through it.
    { provide: MAIL_SENDER, useClass: NodemailerMailSender },
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
  exports: [
    LoginUseCase,
    RefreshTokenUseCase,
    GetMeUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    MAIL_SENDER,
  ],
})
export class AuthModule {}
