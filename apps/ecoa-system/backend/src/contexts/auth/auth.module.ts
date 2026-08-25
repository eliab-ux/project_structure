import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { EMAIL_SENDER } from './application/ports/output/email-sender.port';
import { NodemailerEmailSender } from '../../infrastructure/email/nodemailer-email-sender.service';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh/refresh-token.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';

@Module({
  imports: [ConfigModule, UserModule],
  providers: [
    { provide: EMAIL_SENDER, useClass: NodemailerEmailSender },
    LoginUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
  exports: [LoginUseCase, RefreshTokenUseCase, RequestPasswordResetUseCase, ResetPasswordUseCase],
})
export class AuthModule {}
