import { PasswordResetCode } from '../../../src/contexts/auth/domain/entities/password-reset-code.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';

const accountId = AccountId.create();
const userId = UserId.create();

function issue(now = new Date()): PasswordResetCode {
  return PasswordResetCode.issue({ accountId, userId, codeHash: '$2a$12$hash', now });
}

describe('PasswordResetCode', () => {
  describe('geração', () => {
    it('gera exatamente 6 dígitos, com zeros à esquerda preservados', () => {
      for (let i = 0; i < 200; i += 1) {
        expect(PasswordResetCode.generatePlainCode()).toMatch(/^\d{6}$/);
      }
    });

    it('não repete o mesmo código em sequência (não é constante)', () => {
      const codes = new Set(
        Array.from({ length: 50 }, () => PasswordResetCode.generatePlainCode()),
      );
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  it('vale 15 minutos', () => {
    const now = new Date('2026-08-14T10:00:00.000Z');
    expect(issue(now).expiresAt.toISOString()).toBe('2026-08-14T10:15:00.000Z');
  });

  it('é usável enquanto novo', () => {
    expect(issue().isUsable()).toBe(true);
  });

  it('deixa de ser usável depois de expirar', () => {
    const now = new Date('2026-08-14T10:00:00.000Z');
    const code = issue(now);
    expect(code.isUsable(new Date('2026-08-14T10:14:59.000Z'))).toBe(true);
    expect(code.isUsable(new Date('2026-08-14T10:15:01.000Z'))).toBe(false);
  });

  it('deixa de ser usável depois de usado', () => {
    const code = issue();
    code.markUsed();
    expect(code.isUsable()).toBe(false);
  });

  it('deixa de ser usável quando invalidado por um pedido novo', () => {
    const code = issue();
    code.invalidate();
    expect(code.isUsable()).toBe(false);
  });

  it('morre na 5ª tentativa — 1.000.000 de combinações viram 5 chances', () => {
    const code = issue();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      code.registerAttempt();
      expect(code.isUsable()).toBe(true);
    }
    code.registerAttempt();
    expect(code.attempts).toBe(PasswordResetCode.MAX_ATTEMPTS);
    expect(code.isUsable()).toBe(false);
  });

  it('nasce sem sent_at — o limite por hora só conta o que foi realmente enviado', () => {
    const code = issue();
    expect(code.sentAt).toBeNull();
    code.markSent();
    expect(code.sentAt).not.toBeNull();
  });
});
