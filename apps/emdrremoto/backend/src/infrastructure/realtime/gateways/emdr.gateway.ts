import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { REALTIME_EVENTS, sessionRoom } from '../events';
import { AudioActionDto, BallActionDto } from '../dto/realtime.dto';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { corsOrigin } from '../cors';

/**
 * Estímulo bilateral (bola) e áudio. A autorização já foi feita no `join-session` do
 * SessionGateway (o socket só tem `sessionCode` se entrou autorizado) — aqui apenas
 * roteamos por room, SEM consultar o banco a cada evento (latência mínima no tempo real).
 */
@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class EmdrGateway {
  @SubscribeMessage(REALTIME_EVENTS.BALL_HANDLER)
  onBall(@ConnectedSocket() client: Socket, @MessageBody() action: BallActionDto): void {
    const code = client.data?.sessionCode as string | undefined;
    if (!code) {
      return; // não entrou numa sessão → nada a rotear
    }
    client.to(sessionRoom(code)).emit(REALTIME_EVENTS.BALL_HANDLER, action);
  }

  @SubscribeMessage(REALTIME_EVENTS.AUDIO_HANDLER)
  onAudio(@ConnectedSocket() client: Socket, @MessageBody() action: AudioActionDto): void {
    const code = client.data?.sessionCode as string | undefined;
    if (!code) {
      return;
    }
    client.to(sessionRoom(code)).emit(REALTIME_EVENTS.AUDIO_HANDLER, action);
  }
}
