import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from '../../contexts/account/account.module';
import { WHATSAPP_GATEWAY } from './ports/whatsapp-gateway.port';
import { EvolutionGateway } from './evolution.gateway';
import { EvolutionServerResolver } from './evolution-server-resolver.service';

/**
 * The WhatsApp outbound adapter. Global because every context that sends (channel now, dispatch and
 * inbox later) needs the gateway, and re-importing it everywhere would be noise.
 *
 * AccountModule is imported for one reason only: the resolver reads `accounts.evolution_server_url`
 * to decide WHICH server a tenant talks to (§14, decisão 7).
 */
@Global()
@Module({
  imports: [ConfigModule, AccountModule],
  providers: [EvolutionServerResolver, { provide: WHATSAPP_GATEWAY, useClass: EvolutionGateway }],
  exports: [WHATSAPP_GATEWAY, EvolutionServerResolver],
})
export class WhatsAppModule {}
