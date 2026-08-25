import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { PasswordResetCodeOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/password-reset-code-orm.entity';
import { PasswordResetCodeMapper } from '../../infrastructure/persistence/mikro-orm/mappers/password-reset-code.mapper';
import { MikroOrmPasswordResetCodeRepository } from '../../infrastructure/persistence/mikro-orm/repositories/password-reset-code.repository';
import { EvolutionSupportMessenger } from '../../infrastructure/whatsapp/evolution-support-messenger.adapter';
import { UserModule } from '../user/user.module';
import { PASSWORD_RESET_CODE_REPOSITORY } from './application/ports/output/password-reset-code-repository.port';
import { SUPPORT_MESSENGER } from './application/ports/output/support-messenger.port';
import { LoginUseCase } from './application/use-cases/login/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh/refresh-token.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password/reset-password.use-case';

@Module({
  // Depende do UserModule pelo USER_REPOSITORY: o auth valida credenciais mas não é dono do usuário.
  imports: [ConfigModule, UserModule, MikroOrmModule.forFeature([PasswordResetCodeOrmEntity])],
  providers: [
    PasswordResetCodeMapper,
    {
      provide: PASSWORD_RESET_CODE_REPOSITORY,
      useClass: MikroOrmPasswordResetCodeRepository,
    },
    // O "Suporte PSI" da Evolution atende este port. Trocar de canal (SMS, e-mail) é trocar
    // esta linha — nenhum use case sabe qual é o canal.
    { provide: SUPPORT_MESSENGER, useClass: EvolutionSupportMessenger },
    LoginUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
  ],
  exports: [LoginUseCase, RefreshTokenUseCase, RequestPasswordResetUseCase, ResetPasswordUseCase],
})
export class AuthModule {}
