import { Psicologo } from '../../../src/contexts/psicologo/domain/entities/psicologo.entity';
import { Email } from '../../../src/contexts/psicologo/domain/value-objects/email.vo';
import { PsicologoRegisteredEvent } from '../../../src/contexts/psicologo/domain/events/psicologo-registered.event';

describe('Psicologo (domain)', () => {
  const email = Email.create('Dra.Ana@Example.com');

  it('normalizes email on the value object', () => {
    expect(email.value).toBe('dra.ana@example.com');
  });

  it('registers unverified and emits PsicologoRegisteredEvent', () => {
    const p = Psicologo.register(email, 'Ana Souza', '11999998888', 'hash');
    expect(p.emailVerificado).toBe(false);
    expect(p.active).toBe(true);
    const events = p.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PsicologoRegisteredEvent);
  });

  it('rejects a name shorter than 2 chars', () => {
    expect(() => Psicologo.register(email, 'A', '11999998888', 'hash')).toThrow();
  });

  it('verifies email and clears recovery code on password change', () => {
    const p = Psicologo.register(email, 'Ana Souza', '11999998888', 'hash');
    p.verifyEmail();
    expect(p.emailVerificado).toBe(true);

    p.setRecoveryCode('123456');
    expect(p.matchesRecoveryCode('123456')).toBe(true);

    p.changePassword('newhash');
    expect(p.recoveryCode).toBeNull();
    expect(p.matchesRecoveryCode('123456')).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(() => Email.create('not-an-email')).toThrow();
  });
});
