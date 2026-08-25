import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '../../security/ports/token-service.port';

/**
 * Autentica o handshake do Socket.IO reusando o TokenServicePort (mesmo JWT do HTTP).
 * Token em `handshake.auth.token` — NUNCA na query string. Popula `client.data.user`.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    // Se a conexão já autenticou (handleConnection), reaproveita.
    if (client.data?.user) {
      return true;
    }
    const token = client.handshake?.auth?.token as string | undefined;
    if (!token) {
      throw new WsException('Unauthorized');
    }
    try {
      client.data.user = (await this.tokens.verifyAccessToken(token)) as AuthTokenPayload;
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
