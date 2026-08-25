import { WebhookRejectionLog } from '../../../src/infrastructure/security/webhook-rejection.log';

/**
 * Small, and it closes the one hole the diagnosis could not see.
 *
 * The screen can report that the webhook SENDS an auth header, never whether the value is right — the
 * expected token is a secret and comparing it for the operator would mean echoing it back. So a
 * mismatched `EVOLUTION_WEBHOOK_TOKEN` passed every check while the backend answered 401 to every call
 * and the provider gave up: invisible, and indistinguishable from "nobody replied".
 *
 * A refusal proves the opposite of silence — the POST IS arriving — which is the most expensive fork in
 * the whole investigation.
 */
describe('WebhookRejectionLog', () => {
  it('starts clean, so a healthy backend reports nothing', () => {
    const log = new WebhookRejectionLog();

    expect(log.snapshot().invalidTokenCount).toBe(0);
    expect(log.snapshot().lastInvalidTokenAt).toBeNull();
  });

  it('counts refusals and keeps the last one', () => {
    const log = new WebhookRejectionLog();

    log.recordInvalidToken();
    log.recordInvalidToken();
    log.recordInvalidToken();

    const snapshot = log.snapshot();
    expect(snapshot.invalidTokenCount).toBe(3);
    expect(snapshot.lastInvalidTokenAt).toBeInstanceOf(Date);
  });

  it('reports the instant it started counting, because the reading is always "since the restart"', () => {
    // In memory on purpose: this endpoint is reachable from the internet, so a row per refusal would
    // hand a stranger an unbounded write. The cost is that a restart forgets — hence `since`, so the
    // screen can say what window the number covers instead of implying "ever".
    const log = new WebhookRejectionLog();

    expect(log.snapshot().since).toBeInstanceOf(Date);
  });

  it('never stores anything about the token itself', () => {
    const log = new WebhookRejectionLog();

    log.recordInvalidToken();

    // Not the received value, not even its length: the whole object is safe to serialise to a screen.
    const serialised = JSON.stringify(log.snapshot());
    expect(serialised).not.toMatch(/token["']?\s*:\s*["']/i);
    expect(Object.keys(log.snapshot()).sort()).toEqual([
      'invalidTokenCount',
      'lastInvalidTokenAt',
      'since',
    ]);
  });
});
