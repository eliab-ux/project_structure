import { Injectable } from '@nestjs/common';

/**
 * Counts webhook calls refused for a bad token, in memory.
 *
 * Why this exists: the diagnosis can report that the webhook SENDS an auth header, but never whether the
 * value is the right one — the expected token is a secret and comparing it for the operator would mean
 * echoing it back. So a mismatched `EVOLUTION_WEBHOOK_TOKEN` passed every check on the screen while the
 * backend answered 401 to every call and the provider quietly gave up. Invisible, and it looked exactly
 * like "nobody replied".
 *
 * A refusal proves the opposite of silence: the POST **is** arriving. That single fact splits "the
 * provider is not calling us" from "we are turning it away", which is the most expensive fork in this
 * whole investigation. Counting it turns an invisible failure into a visible one.
 *
 * **In memory on purpose.** This endpoint is reachable from the internet by anyone, so persisting a row
 * per refusal would hand a stranger an unbounded write — a cheap way to fill the disk or drown the audit
 * trail. A counter costs nothing and cannot be used to push. The trade-off is that a restart forgets, so
 * the reading is always "since the backend last started", and it says so where it is displayed.
 *
 * Nothing about the token itself is stored — not the received value, not its length. Only that a refusal
 * happened and when.
 */
@Injectable()
export class WebhookRejectionLog {
  private invalidTokenCount = 0;
  private lastInvalidTokenAt: Date | null = null;
  private readonly startedAt = new Date();

  recordInvalidToken(): void {
    this.invalidTokenCount += 1;
    this.lastInvalidTokenAt = new Date();
  }

  snapshot(): { invalidTokenCount: number; lastInvalidTokenAt: Date | null; since: Date } {
    return {
      invalidTokenCount: this.invalidTokenCount,
      lastInvalidTokenAt: this.lastInvalidTokenAt,
      since: this.startedAt,
    };
  }
}
