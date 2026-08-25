import { timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { WebhookRejectionLog } from '../webhook-rejection.log';

export const EVOLUTION_WEBHOOK_TOKEN_HEADER = 'x-batuta-webhook-token';

/**
 * Authenticates the Evolution webhook by a shared token in a header (§5, FASE 2 item 4).
 *
 * Why a token and not a JWT: the caller is the Evolution server, which has no user and no session.
 * The token is configured when the instance is created, so it is the same secret on both sides.
 *
 * Compared in constant time. A plain `===` on a secret leaks its length and prefix through timing,
 * and this endpoint is reachable from the internet by definition.
 *
 * Note what the token does NOT grant: it does not select a tenant. The tenant comes from the
 * namespaced instance name in the payload, so a leaked token cannot be pointed at another account.
 */
@Injectable()
export class EvolutionWebhookGuard implements CanActivate {
  private readonly logger = new Logger(EvolutionWebhookGuard.name);

  constructor(
    private readonly config: ConfigService,
    // Records refusals so the webhook diagnosis can say "the calls ARE arriving and we are turning them
    // away" — the one thing the screen could not tell, because checking the token VALUE for the operator
    // would mean echoing a secret back.
    private readonly rejections: WebhookRejectionLog,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('EVOLUTION_WEBHOOK_TOKEN');

    if (!expected) {
      // Fail closed: an unconfigured webhook must reject everything, not accept everything.
      this.logger.error('EVOLUTION_WEBHOOK_TOKEN não configurado — webhook recusado');
      throw new UnauthorizedException('Webhook não configurado.');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const received = request.headers[EVOLUTION_WEBHOOK_TOKEN_HEADER];
    const token = Array.isArray(received) ? received[0] : received;

    if (!token || !EvolutionWebhookGuard.matches(token, expected)) {
      this.rejections.recordInvalidToken();
      this.logger.warn('Webhook recusado: token inválido');
      throw new UnauthorizedException('Token de webhook inválido.');
    }

    return true;
  }

  private static matches(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch, which would itself leak the length.
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
