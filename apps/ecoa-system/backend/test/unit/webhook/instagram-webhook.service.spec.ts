import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InstagramWebhookService } from '../../../src/infrastructure/http/controllers/webhook/instagram-webhook.service';

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'verify-tok';

function makeService(): InstagramWebhookService {
  const config = {
    get: (name: string) => {
      if (name === 'META_APP_SECRET') return APP_SECRET;
      if (name === 'META_WEBHOOK_VERIFY_TOKEN') return VERIFY_TOKEN;
      return undefined;
    },
  };
  // resolveOwner + ingestion are unused by the methods under test.
  return new InstagramWebhookService(config as unknown as ConfigService, {} as never, {} as never);
}

describe('InstagramWebhookService — verification (defense in depth)', () => {
  it('echoes the challenge only when the verify token matches', () => {
    const svc = makeService();
    expect(svc.verifyHandshake('subscribe', VERIFY_TOKEN, '12345')).toBe('12345');
    expect(svc.verifyHandshake('subscribe', 'wrong', '12345')).toBeNull();
    expect(svc.verifyHandshake('other', VERIFY_TOKEN, '12345')).toBeNull();
  });

  it('accepts a correctly signed payload (X-Hub-Signature-256)', () => {
    const svc = makeService();
    const body = Buffer.from(JSON.stringify({ object: 'instagram', entry: [] }));
    const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
    expect(svc.verifySignature(body, sig)).toBe(true);
  });

  it('rejects a wrong/absent signature', () => {
    const svc = makeService();
    const body = Buffer.from('{"a":1}');
    expect(svc.verifySignature(body, 'sha256=deadbeef')).toBe(false);
    expect(svc.verifySignature(body, undefined)).toBe(false);
    expect(svc.verifySignature(undefined, 'sha256=abc')).toBe(false);
  });
});
