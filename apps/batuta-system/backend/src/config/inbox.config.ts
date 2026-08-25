import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Inbox numbers, in one place (§10.3).
 *
 * ⚠️ DECISÃO PENDENTE (§14 item 12): TTL do travamento de conversa — **15 min**, the value §14 itself
 * suggests. The trade-off is stated in §10.3: too long and an operator who closed the tab freezes that
 * contact ("item parado três dias é pior que não ter a caixa"); too short and two people end up in the
 * same conversation, which the spec calls worse than delay. Fifteen minutes is about as long as one
 * item can honestly take.
 *
 * `historyLimit` is not in the spec: §10.1 asks for "o histórico completo" and this is the ceiling that
 * keeps a five-year thread from becoming a 40 MB response. It is high enough that no real conversation
 * reaches it.
 */
@Injectable()
export class InboxConfig {
  constructor(private readonly config: ConfigService) {}

  /** §14 item 12 — DECISÃO PENDENTE (sugestão do spec: 15 min). */
  get lockTtlMinutes(): number {
    return this.int('INBOX_LOCK_TTL_MINUTES', 15);
  }

  /** Messages returned when an item is opened. */
  get historyLimit(): number {
    return this.int('INBOX_HISTORY_LIMIT', 200);
  }

  /** How long a signed media URL lasts — long enough to listen to an audio, not to share it. */
  get mediaUrlTtlSeconds(): number {
    return this.int('INBOX_MEDIA_URL_TTL_SECONDS', 600);
  }

  private int(key: string, fallback: number): number {
    const parsed = Number.parseInt(String(this.config.get(key) ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
