import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { INSTAGRAM_GATEWAY } from './instagram/ports/instagram-gateway.port';
import { InstagramGraphGateway } from './instagram/instagram-graph.gateway';

/**
 * Global boundary to external services. The Instagram Graph API adapter is the only place
 * that talks to Meta; it is exported globally so any context can inject INSTAGRAM_GATEWAY
 * without importing this module. Swapping the adapter (e.g. a sandbox/mock) is a one-line
 * change here — nothing else moves.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
  ],
  providers: [{ provide: INSTAGRAM_GATEWAY, useClass: InstagramGraphGateway }],
  exports: [INSTAGRAM_GATEWAY],
})
export class IntegrationsModule {}
