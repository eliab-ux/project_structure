import { ApprovalRequest } from '../../../src/contexts/approval/domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../src/contexts/approval/domain/entities/approval-settings.entity';
import { Approver } from '../../../src/contexts/approval/domain/entities/approver.entity';
import { ApprovalRequestStatus } from '../../../src/contexts/approval/domain/value-objects/approval-status.vo';
import {
  approvalTokenHashMatches,
  hashApprovalToken,
  issueApprovalToken,
} from '../../../src/contexts/approval/domain/value-objects/approval-token.vo';
import { NotifyChannel } from '../../../src/contexts/approval/domain/value-objects/notify-channel.vo';
import { InvalidApprovalTokenException } from '../../../src/contexts/approval/domain/exceptions/invalid-approval-token.exception';
import { InvalidApprovalSettingsException } from '../../../src/contexts/approval/domain/exceptions/invalid-approval-settings.exception';
import { ApproverWithoutContactException } from '../../../src/contexts/approval/domain/exceptions/approver-without-contact.exception';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const APPROVER_ID = 'cccccccc-1111-4111-8111-111111111111';
const HASH_V1 = 'a'.repeat(64);
const HASH_V2 = 'b'.repeat(64);

function issue(ttlHours = 72): { request: ApprovalRequest; plaintext: string } {
  const { request, token } = ApprovalRequest.issue({
    accountId: ACCOUNT_ID,
    contentId: CONTENT_ID,
    contentHash: HASH_V1,
    approverId: APPROVER_ID,
    ttlHours,
  });
  return { request, plaintext: token.plaintext };
}

/** A request as it comes back from the database, with an arbitrary status and expiry. */
function stored(overrides: {
  status?: ApprovalRequestStatus;
  expiresAt?: Date;
  contentHash?: string;
}): ApprovalRequest {
  return ApprovalRequest.reconstitute({
    id: 'dddddddd-1111-4111-8111-111111111111',
    accountId: ACCOUNT_ID,
    contentId: CONTENT_ID,
    contentHash: overrides.contentHash ?? HASH_V1,
    approverId: APPROVER_ID,
    tokenHash: hashApprovalToken('qualquer-coisa'),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3_600_000),
    status: overrides.status ?? ApprovalRequestStatus.PENDING,
    decidedAt: null,
    decidedIp: null,
    decidedUserAgent: null,
    comment: null,
    createdAt: new Date(),
  });
}

describe('Magic-link token', () => {
  it('is high entropy and never stored in the clear', () => {
    const token = issueApprovalToken();

    // 32 random bytes in base64url — no padding, URL-safe, so it survives being pasted anywhere.
    expect(token.plaintext).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.hash).not.toContain(token.plaintext);
  });

  it('two tokens never collide', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => issueApprovalToken().plaintext));
    expect(tokens.size).toBe(200);
  });

  it('hashes deterministically, so a link can be looked up by hash', () => {
    const token = issueApprovalToken();
    expect(hashApprovalToken(token.plaintext)).toBe(token.hash);
    expect(approvalTokenHashMatches(hashApprovalToken(token.plaintext), token.hash)).toBe(true);
  });

  it('a wrong token does not match', () => {
    const a = issueApprovalToken();
    const b = issueApprovalToken();
    expect(approvalTokenHashMatches(a.hash, b.hash)).toBe(false);
  });

  it('the request exposes only the hash, never the plaintext', () => {
    const { request, plaintext } = issue();

    expect(request.tokenHashForPersistence()).toBe(hashApprovalToken(plaintext));
    // Serialising the whole aggregate must not leak the credential.
    expect(JSON.stringify(request)).not.toContain(plaintext);
  });
});

describe('ApprovalRequest — the four ways a link stops working', () => {
  it('accepts a pending, unexpired request on the same version', () => {
    const { request } = issue();
    expect(() => request.assertUsable(HASH_V1)).not.toThrow();
  });

  it('single use: a decided request refuses a second decision', () => {
    const { request } = issue();
    request.approve({ ip: '203.0.113.7', userAgent: 'iPhone', comment: null });

    expect(() => request.assertUsable(HASH_V1)).toThrow(InvalidApprovalTokenException);
  });

  it('TTL: an expired request is refused even while still PENDING', () => {
    const request = stored({ expiresAt: new Date(Date.now() - 1_000) });

    expect(request.isPending).toBe(true);
    expect(() => request.assertUsable(HASH_V1)).toThrow(/prazo/i);
  });

  it('edited content: a hash mismatch is refused (§8.5)', () => {
    const { request } = issue();

    expect(() => request.assertUsable(HASH_V2)).toThrow(/editado/i);
  });

  it('INVALIDATED is refused with the reason the approver actually needs', () => {
    const request = stored({ status: ApprovalRequestStatus.INVALIDATED });

    expect(() => request.assertUsable(HASH_V1)).toThrow(/editado/i);
  });
});

describe('ApprovalRequest — what a decision records', () => {
  it('an approval records who, when, from where and on what', () => {
    const { request } = issue();

    request.approve({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0', comment: '  de acordo  ' });

    expect(request.status).toBe(ApprovalRequestStatus.APPROVED);
    expect(request.decidedAt).toBeInstanceOf(Date);
    expect(request.decidedIp).toBe('203.0.113.7');
    expect(request.decidedUserAgent).toBe('Mozilla/5.0');
    expect(request.comment).toBe('de acordo');
    // The version is the whole point: the record is about THIS text, not about "the content".
    expect(request.contentHash).toBe(HASH_V1);
  });

  it('a rejection carries the comment, which the author will read', () => {
    const { request } = issue();

    request.reject({ ip: null, userAgent: null, comment: 'Trocar "obra" por "reforma".' });

    expect(request.status).toBe(ApprovalRequestStatus.REJECTED);
    expect(request.comment).toBe('Trocar "obra" por "reforma".');
  });

  it('an empty comment is stored as null rather than as an empty string', () => {
    const { request } = issue();
    request.approve({ ip: null, userAgent: null, comment: '   ' });
    expect(request.comment).toBeNull();
  });

  it('a hostile user-agent is truncated before it reaches the database column', () => {
    const { request } = issue();
    request.approve({ ip: null, userAgent: 'x'.repeat(5_000), comment: null });
    expect(request.decidedUserAgent).toHaveLength(300);
  });

  it('emits a domain event carrying the version decided upon', () => {
    const { request } = issue();
    request.approve({ ip: null, userAgent: null, comment: null });

    const events = request.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).toContain(HASH_V1);
  });

  it('invalidate and markExpired only touch a pending request', () => {
    const decided = stored({ status: ApprovalRequestStatus.APPROVED });

    decided.invalidate();
    decided.markExpired();

    // A recorded human decision is never overwritten by a background transition.
    expect(decided.status).toBe(ApprovalRequestStatus.APPROVED);
  });
});

describe('ApprovalSettings — 1 or 2, per classification', () => {
  it('defaults to 1 institutional / 2 electoral', () => {
    const settings = ApprovalSettings.createDefault(ACCOUNT_ID);

    expect(settings.requiredFor(ContentClassification.INSTITUTIONAL)).toBe(1);
    expect(settings.requiredFor(ContentClassification.ELECTORAL)).toBe(2);
    expect(settings.notifyChannel).toBe(NotifyChannel.EMAIL);
  });

  it('the two classifications are configured independently (§8 item 1)', () => {
    const settings = ApprovalSettings.createDefault(ACCOUNT_ID);

    settings.change({ requiredForInstitutional: 2, requiredForElectoral: 1 });

    expect(settings.requiredFor(ContentClassification.INSTITUTIONAL)).toBe(2);
    expect(settings.requiredFor(ContentClassification.ELECTORAL)).toBe(1);
  });

  it.each([0, 3, -1, 1.5])('refuses %p approvals — the spec says 1 or 2', (count) => {
    const settings = ApprovalSettings.createDefault(ACCOUNT_ID);

    expect(() => settings.change({ requiredForElectoral: count })).toThrow(
      InvalidApprovalSettingsException,
    );
    // The refusal leaves the previous value in place.
    expect(settings.requiredFor(ContentClassification.ELECTORAL)).toBe(2);
  });
});

describe('Approver — reachable, and never the author', () => {
  it('needs at least one way of being reached', () => {
    expect(() =>
      Approver.create({ accountId: ACCOUNT_ID, name: 'Ana', email: null, phone: null }),
    ).toThrow(ApproverWithoutContactException);
  });

  it('an e-mail alone is enough, and a phone alone is enough', () => {
    const byEmail = Approver.create({
      accountId: ACCOUNT_ID,
      name: 'Ana',
      email: Email.create('ana@exemplo.com'),
      phone: null,
    });
    const byPhone = Approver.create({
      accountId: ACCOUNT_ID,
      name: 'Bruno',
      email: null,
      phone: PhoneE164.create('+5511988887777'),
    });

    expect(byEmail.canReceiveEmail).toBe(true);
    expect(byEmail.canReceiveWhatsApp).toBe(false);
    expect(byPhone.canReceiveWhatsApp).toBe(true);
  });

  it('cannot be edited into being unreachable', () => {
    const approver = Approver.create({
      accountId: ACCOUNT_ID,
      name: 'Ana',
      email: Email.create('ana@exemplo.com'),
      phone: null,
    });

    expect(() => approver.change({ email: null })).toThrow(ApproverWithoutContactException);
    expect(approver.email?.value).toBe('ana@exemplo.com');
  });

  it('identifies the author by e-mail, case-insensitively (§8.5 + §14 item 11)', () => {
    const approver = Approver.create({
      accountId: ACCOUNT_ID,
      name: 'Ana',
      email: Email.create('ana@exemplo.com'),
      phone: null,
    });

    expect(approver.isSamePersonAs('ANA@Exemplo.com  ')).toBe(true);
    expect(approver.isSamePersonAs('outra@exemplo.com')).toBe(false);
    // No e-mail on either side means the check simply cannot exclude anyone — it must not guess.
    expect(approver.isSamePersonAs(null)).toBe(false);
  });

  it('is deactivated, never deleted — past decisions must stay attributable', () => {
    const approver = Approver.create({
      accountId: ACCOUNT_ID,
      name: 'Ana',
      email: Email.create('ana@exemplo.com'),
      phone: null,
    });

    approver.deactivate();
    expect(approver.active).toBe(false);

    approver.activate();
    expect(approver.active).toBe(true);

    // There is no delete on the entity at all, by design.
    const methods = Object.getOwnPropertyNames(Approver.prototype).filter(
      (name) =>
        typeof Object.getOwnPropertyDescriptor(Approver.prototype, name)?.value === 'function',
    );
    expect(methods).not.toContain('delete');
    expect(methods).not.toContain('remove');
  });
});
