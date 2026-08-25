import { Module } from '@nestjs/common';
import { SessionModule } from '../../contexts/session/session.module';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { SessionGateway } from './gateways/session.gateway';
import { EmdrGateway } from './gateways/emdr.gateway';
import { ChatGateway } from './gateways/chat.gateway';
import { WebrtcGateway } from './gateways/webrtc.gateway';

/**
 * Real-time Adapter (Socket.IO via NestJS Gateway). Sobe na mesma porta do backend
 * (IoAdapter registrado no main.ts). Reusa TOKEN_SERVICE (SecurityModule global) e os
 * use cases do SessionModule. Um gateway por domínio de eventos (session/emdr/chat).
 */
@Module({
  imports: [SessionModule],
  providers: [WsJwtGuard, SessionGateway, EmdrGateway, ChatGateway, WebrtcGateway],
})
export class RealtimeModule {}
