import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RESET_CODE_MESSENGER } from '../../contexts/auth/application/ports/output/reset-code-messenger.port';
import { EvolutionResetCodeMessenger } from './evolution-reset-code.messenger';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: RESET_CODE_MESSENGER, useClass: EvolutionResetCodeMessenger }],
  exports: [RESET_CODE_MESSENGER],
})
export class WhatsAppModule {}
