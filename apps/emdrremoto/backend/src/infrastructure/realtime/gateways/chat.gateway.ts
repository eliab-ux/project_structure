import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthTokenPayload } from '../../security/ports/token-service.port';
import { REALTIME_EVENTS, sessionRoom } from '../events';
import { ChatMessageDto } from '../dto/realtime.dto';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { corsOrigin } from '../cors';

/**
 * Chat da sessão. Sem buffer no servidor (stateless): a mensagem é apenas roteada para a
 * room. O remetente é derivado do token (nunca do payload) — o cliente não decide quem é.
 */
@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ChatGateway {
  @SubscribeMessage(REALTIME_EVENTS.NEW_MESSAGE)
  onNewMessage(@ConnectedSocket() client: Socket, @MessageBody() message: ChatMessageDto): void {
    const code = client.data?.sessionCode as string | undefined;
    if (!code) {
      return;
    }
    const user = client.data.user as AuthTokenPayload;
    // Autor derivado do token autenticado (não confiar no cliente).
    client.to(sessionRoom(code)).emit(REALTIME_EVENTS.NEW_MESSAGE, {
      text: message.text,
      from: user.role,
      at: new Date().toISOString(),
    });
  }
}
