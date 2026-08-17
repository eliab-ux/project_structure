import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_RESET_NOTIFIER } from '../../contexts/auth/application/ports/output/password-reset-notifier.port';
import { EvolutionPasswordResetNotifier } from './evolution-password-reset-notifier';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: PASSWORD_RESET_NOTIFIER, useClass: EvolutionPasswordResetNotifier }],
  exports: [PASSWORD_RESET_NOTIFIER],
})
export class WhatsAppModule {}
