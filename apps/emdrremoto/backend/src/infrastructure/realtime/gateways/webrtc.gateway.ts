import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { REALTIME_EVENTS, sessionRoom } from '../events';
import { RtcDescriptionDto, RtcIceDto } from '../dto/realtime.dto';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { corsOrigin } from '../cors';

/**
 * Sinalização WebRTC (P2P) — apenas relay dentro da room da sessão. O servidor não vê mídia;
 * só encaminha offer/answer/ICE entre os dois participantes já autorizados no `join-session`.
 */
@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class WebrtcGateway {
  // Handshake: o cliente avisa que já registrou os listeners e está pronto para negociar.
  @SubscribeMessage(REALTIME_EVENTS.RTC_READY)
  onReady(@ConnectedSocket() client: Socket): void {
    this.relay(client, REALTIME_EVENTS.RTC_READY, {});
  }

  @SubscribeMessage(REALTIME_EVENTS.RTC_OFFER)
  onOffer(@ConnectedSocket() client: Socket, @MessageBody() desc: RtcDescriptionDto): void {
    this.relay(client, REALTIME_EVENTS.RTC_OFFER, desc);
  }

  @SubscribeMessage(REALTIME_EVENTS.RTC_ANSWER)
  onAnswer(@ConnectedSocket() client: Socket, @MessageBody() desc: RtcDescriptionDto): void {
    this.relay(client, REALTIME_EVENTS.RTC_ANSWER, desc);
  }

  @SubscribeMessage(REALTIME_EVENTS.RTC_ICE)
  onIce(@ConnectedSocket() client: Socket, @MessageBody() ice: RtcIceDto): void {
    this.relay(client, REALTIME_EVENTS.RTC_ICE, ice);
  }

  private relay(client: Socket, event: string, payload: unknown): void {
    const code = client.data?.sessionCode as string | undefined;
    if (!code) {
      return;
    }
    client.to(sessionRoom(code)).emit(event, payload);
  }
}
