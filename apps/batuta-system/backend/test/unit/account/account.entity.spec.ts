import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../src/contexts/account/domain/value-objects/account-status.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { DailyCeilingExceededException } from '../../../src/contexts/account/domain/exceptions/daily-ceiling-exceeded.exception';
import { InvalidSendCeilingException } from '../../../src/contexts/account/domain/exceptions/invalid-send-ceiling.exception';
import { InvalidDocumentException } from '../../../src/contexts/account/domain/exceptions/invalid-document.exception';

const VALID_CPF = '11144477735';
const VALID_CNPJ = '11222333000181';

function makeAccount(overrides: Partial<{ ceiling: number; status: AccountStatus }> = {}): Account {
  return Account.create({
    name: 'Gabinete Exemplo',
    document: Document.create(VALID_CPF),
    plan: AccountPlan.STANDARD,
    dailySendCeiling: overrides.ceiling ?? 1000,
    timezone: 'America/Sao_Paulo',
    status: overrides.status,
  });
}

describe('Document', () => {
  it('accepts a valid CPF and a valid CNPJ, stripping punctuation', () => {
    expect(Document.create('111.444.777-35').value).toBe(VALID_CPF);
    expect(Document.create('11.222.333/0001-81').value).toBe(VALID_CNPJ);
    expect(Document.create(VALID_CNPJ).isCompany).toBe(true);
  });

  it('rejects an invalid check digit, a repeated sequence and a wrong length', () => {
    expect(() => Document.create('11144477736')).toThrow(InvalidDocumentException);
    expect(() => Document.create('11111111111')).toThrow(InvalidDocumentException);
    expect(() => Document.create('123')).toThrow(InvalidDocumentException);
    expect(() => Document.create('')).toThrow(InvalidDocumentException);
  });

  it('never echoes the document in the error message', () => {
    expect(() => Document.create('11144477736')).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('11144477736'),
      }) as Error,
    );
  });

  it('masks the document for display', () => {
    // Logs and DTOs only ever see this form.
    expect(Document.create(VALID_CPF).masked).toBe('111******35');
  });
});

describe('Account', () => {
  it('starts as TRIAL and can dispatch', () => {
    const account = makeAccount();

    expect(account.status).toBe(AccountStatus.TRIAL);
    expect(account.canDispatch).toBe(true);
    expect(account.isSuspended).toBe(false);
  });

  it('refuses a non-positive or fractional ceiling', () => {
    expect(() => makeAccount({ ceiling: 0 })).toThrow(InvalidSendCeilingException);
    expect(() => makeAccount({ ceiling: -10 })).toThrow(InvalidSendCeilingException);
    expect(() => makeAccount({ ceiling: 10.5 })).toThrow(InvalidSendCeilingException);
  });

  it('starts on the shared Evolution server', () => {
    const account = makeAccount();

    expect(account.evolutionServerUrl).toBeNull();
    expect(account.evolutionApiKey).toBeNull();
  });

  describe('daily ceiling', () => {
    it('allows a plan that fits', () => {
      const account = makeAccount({ ceiling: 100 });

      expect(() => account.assertFitsDailyCeiling(40, 60)).not.toThrow();
      expect(account.remainingDailyAllowance(60)).toBe(40);
    });

    it('refuses a plan that exceeds what is left — never truncates', () => {
      const account = makeAccount({ ceiling: 100 });

      expect(() => account.assertFitsDailyCeiling(41, 60)).toThrow(DailyCeilingExceededException);
    });

    it('reports the excess so the caller can show options', () => {
      const account = makeAccount({ ceiling: 100 });

      expect(() => account.assertFitsDailyCeiling(150, 0)).toThrow(/pedido 150, disponível 100/);
    });

    it('clamps the remaining allowance at zero when already over', () => {
      const account = makeAccount({ ceiling: 100 });

      expect(account.remainingDailyAllowance(140)).toBe(0);
      expect(() => account.assertFitsDailyCeiling(1, 140)).toThrow(DailyCeilingExceededException);
    });
  });

  describe('suspension', () => {
    it('blocks dispatch, records the reason and emits the event', () => {
      const account = makeAccount();

      account.suspend('Taxa de opt-out muito acima do normal', 'admin-1');

      expect(account.status).toBe(AccountStatus.SUSPENDED);
      expect(account.canDispatch).toBe(false);
      // The tenant reads this on their own screen — login stays allowed precisely for that.
      expect(account.suspensionReason).toBe('Taxa de opt-out muito acima do normal');
      expect(account.suspendedAt).toBeInstanceOf(Date);

      const events = account.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('account.suspended');
    });

    it('is idempotent — suspending twice emits one event', () => {
      const account = makeAccount();

      account.suspend('motivo', 'admin-1');
      account.pullDomainEvents();
      account.suspend('outro motivo', 'admin-2');

      expect(account.pullDomainEvents()).toHaveLength(0);
      expect(account.suspensionReason).toBe('motivo');
    });

    it('reactivation clears the reason and emits its own event', () => {
      const account = makeAccount();
      account.suspend('motivo', 'admin-1');
      account.pullDomainEvents();

      account.reactivate('admin-1');

      expect(account.status).toBe(AccountStatus.ACTIVE);
      expect(account.suspendedAt).toBeNull();
      expect(account.suspensionReason).toBeNull();
      expect(account.pullDomainEvents()[0].eventName).toBe('account.reactivated');
    });

    it('reactivating an account that is not suspended does nothing', () => {
      const account = makeAccount();

      account.reactivate('admin-1');

      expect(account.status).toBe(AccountStatus.TRIAL);
      expect(account.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('evolution server assignment', () => {
    it('moves the tenant to a dedicated server and back to the shared one', () => {
      const account = makeAccount();

      account.assignEvolutionServer('https://evo-dedicado.example.com', 'key-123');
      expect(account.evolutionServerUrl).toBe('https://evo-dedicado.example.com');

      account.assignEvolutionServer(null, null);
      expect(account.evolutionServerUrl).toBeNull();
      expect(account.evolutionApiKey).toBeNull();
    });
  });
});
