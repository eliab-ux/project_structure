import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 32 bytes = 256 bits of entropy. Guessing one is not a threat model, it is arithmetic. */
const TOKEN_BYTES = 32;

export interface IssuedApprovalToken {
  /** Plaintext. Exists ONLY inside the link that goes out; never persisted, never logged. */
  plaintext: string;
  /** What goes in the database. */
  hash: string;
}

/**
 * The magic-link token (§8 item 4).
 *
 * Stored as a HASH, exactly like the password-reset token of FASE 1: a database dump must not hand
 * anyone the ability to approve electoral content in someone else's name. The plaintext exists in the
 * e-mail/WhatsApp message and nowhere else.
 *
 * The token IS the credential for a public route, which is why the entropy is high and the TTL is
 * short — and why §8 also asks for a rate limit on the route itself.
 */
export function issueApprovalToken(): IssuedApprovalToken {
  const plaintext = randomBytes(TOKEN_BYTES).toString('base64url');
  return { plaintext, hash: hashApprovalToken(plaintext) };
}

export function hashApprovalToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Constant-time comparison of two token hashes.
 *
 * The lookup itself is by hash equality in the database, so this is for the in-memory checks. A plain
 * `===` on a secret leaks its prefix through timing, and this one is reachable from the internet.
 */
export function approvalTokenHashMatches(a: string, b: string): boolean {
  const left = Buffer.from(a ?? '', 'utf8');
  const right = Buffer.from(b ?? '', 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
