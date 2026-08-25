import { Inject, Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '../../security/ports/token-service.port';
import {
  AssertSessionMembershipUseCase,
  AssertSessionMembershipQuery,
} from '../../../contexts/session/application/use-cases/assert-session-membership/assert-session-membership.use-case';
import {
  RecordEntryUseCase,
  RecordEntryCommand,
} from '../../../contexts/session/application/use-cases/record-entry/record-entry.use-case';
import { REALTIME_EVENTS, sessionRoom } from '../events';
import { JoinSessionDto } from '../dto/realtime.dto';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { corsOrigin } from '../cors';
import { PresenceService } from '../presence.service';

/**
 * Inbound adapter de tempo real. Fino: autentica, autoriza, chama use case, roteia por room.
 * Sem regra de negócio. Autoriza no `join-session` — depois o roteamento é por room, sem
 * consultar o banco a cada evento (é aqui que estava o gargalo do legado).
 */
@WebSocketGateway({ cors: { origin: corsOrigin(), credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SessionGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly assertMembership: AssertSessionMembershipUseCase,
    private readonly recordEntry: RecordEntryUseCase,
    private readonly presence: PresenceService,
    // Necessário para o @CreateRequestContext() forkar o EntityManager fora de request HTTP
    // (acessado via this.orm em runtime pelo decorator; público para o TS não marcar unused).
    readonly orm: MikroORM,
  ) {}

  // Autenticação no handshake (defesa em profundidade): sockets sem token válido caem.
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake?.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      client.data.user = (await this.tokens.verifyAccessToken(token)) as AuthTokenPayload;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data?.user as AuthTokenPayload | undefined;
    const code = client.data?.sessionCode as string | undefined;
    // Presença no dashboard: paciente saiu de uma sala.
    if (user?.role === 'paciente') {
      this.presence.disconnect(user.sub);
    }
    if (code) {
      client.to(sessionRoom(code)).emit(REALTIME_EVENTS.DISCONNECT_USER, {
        role: user?.role,
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(REALTIME_EVENTS.JOIN_SESSION)
  @CreateRequestContext()
  async onJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinSessionDto,
  ): Promise<{ joined: boolean }> {
    const user = client.data.user as AuthTokenPayload;

    // Menor privilégio: confirma que o usuário pertence a ESTA sessão antes de entrar.
    await this.assertMembership.execute(
      new AssertSessionMembershipQuery(user.sub, user.role, body.sessionCode),
    );

    const room = sessionRoom(body.sessionCode);
    await client.join(room);
    client.data.sessionCode = body.sessionCode;

    // Presença no dashboard: paciente está online numa sala.
    if (user.role === 'paciente') {
      this.presence.connect(user.sub);
    }

    await this.recordEntry
      .execute(new RecordEntryCommand(user.sub, user.role, body.sessionCode))
      .catch((error) => this.logger.error('Falha ao registrar entrada', { error }));

    // Presença: avisa a sala que um participante entrou...
    client.to(room).emit(REALTIME_EVENTS.USER_JOINED, { role: user.role });
    // ...e informa o recém-chegado se o outro JÁ estava na sala (cobre a ordem de entrada).
    const sockets = await this.server.in(room).fetchSockets();
    if (sockets.some((s) => s.id !== client.id)) {
      client.emit(REALTIME_EVENTS.PEER_PRESENT, { present: true });
    }
    return { joined: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(REALTIME_EVENTS.END_CALL)
  onEndCall(@ConnectedSocket() client: Socket): void {
    const code = client.data?.sessionCode as string | undefined;
    if (!code) {
      return;
    }
    this.server.to(sessionRoom(code)).emit(REALTIME_EVENTS.END_CALL);
  }
}
