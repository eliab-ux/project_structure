import { CanActivate, ExecutionContext, HttpException, Injectable, Logger } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';

/** Window and budgets. Operational values, not business rules — see the class docblock. */
const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;
const MAX_PER_TOKEN = 10;
/** Above this many tracked keys the oldest windows are dropped, so a flood cannot grow the map. */
const MAX_TRACKED_KEYS = 20_000;

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Rate limit for the public approval route (§8 item 4: "rate limit por IP e por token").
 *
 * Two independent budgets, because they defend against different things:
 *  - **per IP** — someone spraying random tokens from one place;
 *  - **per token** — someone who got hold of one link and hammers it, or a mail scanner that fetches
 *    the URL in a loop.
 *
 * The token is keyed by its SHA-256, never by the plaintext: this map would otherwise become a
 * collection of live credentials sitting in memory.
 *
 * **In-process, deliberately.** With one instance this is exact; with several it becomes N× looser.
 * That is acceptable because this is the *second* line of defence — the first is a 256-bit token, stored
 * hashed, single use, with a TTL — and the alternative (Redis) only arrives with the queue in FASE 7.
 * When it does, this guard is the single place to change.
 *
 * The failure mode is deliberate too: if the map were somehow unusable, the request goes through. A
 * broken rate limiter must not lock a lawyer out of approving campaign content at 23h on a deadline;
 * the token still protects the route.
 */
@Injectable()
export class ApprovalRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ApprovalRateLimitGuard.name);
  private readonly windows = new Map<string, Window>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const now = Date.now();

    const ip = request.ip ?? 'unknown';
    const token = this.tokenOf(request);

    // Both budgets are consumed on every hit, so a caller cannot dodge one by varying the other.
    const ipAllowed = this.consume(`ip:${ip}`, MAX_PER_IP, now);
    const tokenAllowed = token
      ? this.consume(`tk:${createHash('sha256').update(token).digest('hex')}`, MAX_PER_TOKEN, now)
      : true;

    if (ipAllowed && tokenAllowed) {
      return true;
    }

    // Logged without the token: the whole point of hashing it above.
    this.logger.warn('Rate limit da rota pública de aprovação atingido', {
      ip,
      reason: ipAllowed ? 'token' : 'ip',
    });
    throw new HttpException('Muitas tentativas. Aguarde um minuto e tente novamente.', 429);
  }

  /** The token travels in the path (`/public/approvals/:token`). */
  private tokenOf(request: FastifyRequest): string | null {
    const params = request.params as Record<string, string> | undefined;
    const token = params?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private consume(key: string, max: number, now: number): boolean {
    const current = this.windows.get(key);

    if (!current || current.resetAt <= now) {
      if (this.windows.size >= MAX_TRACKED_KEYS) {
        this.evictExpired(now);
      }
      this.windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    current.count += 1;
    return current.count <= max;
  }

  private evictExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
    // Still full means a genuine flood of distinct keys: drop everything rather than grow without
    // bound. Losing counters costs one extra window of tolerance; leaking memory costs the process.
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      this.windows.clear();
      this.logger.warn('Janelas de rate limit descartadas por volume de chaves distintas');
    }
  }
}
