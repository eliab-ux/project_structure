import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { DailySendUsagePort } from '../../../src/contexts/account/application/ports/output/daily-send-usage.port';
import { EnsureAccountCanDispatchUseCase } from '../../../src/contexts/account/application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.use-case';
import { EnsureAccountCanDispatchCommand } from '../../../src/contexts/account/application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.command';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { AccountNotFoundException } from '../../../src/contexts/account/domain/exceptions/account-not-found.exception';
import { AccountSuspendedException } from '../../../src/contexts/account/domain/exceptions/account-suspended.exception';
import { DailyCeilingExceededException } from '../../../src/contexts/account/domain/exceptions/daily-ceiling-exceeded.exception';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function makeAccount(ceiling = 1000): Account {
  return Account.create({
    name: 'Gabinete Exemplo',
    document: Document.create('11144477735'),
    plan: AccountPlan.STANDARD,
    dailySendCeiling: ceiling,
    timezone: 'America/Sao_Paulo',
  });
}

describe('EnsureAccountCanDispatchUseCase', () => {
  let accounts: jest.Mocked<AccountRepositoryPort>;
  let usage: jest.Mocked<DailySendUsagePort>;
  let useCase: EnsureAccountCanDispatchUseCase;

  beforeEach(() => {
    accounts = {
      findById: jest.fn(),
      existsByDocument: jest.fn(),
      save: jest.fn(),
      listForPlatform: jest.fn(),
    } as unknown as jest.Mocked<AccountRepositoryPort>;
    usage = {
      totalSentToday: jest.fn(async () => 0),
    } as unknown as jest.Mocked<DailySendUsagePort>;
    useCase = new EnsureAccountCanDispatchUseCase(accounts, usage);
  });

  it('reports the remaining allowance for an active account', async () => {
    accounts.findById.mockResolvedValue(makeAccount(1000));
    usage.totalSentToday.mockResolvedValue(300);

    const allowance = await useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID));

    expect(allowance.dailySendCeiling).toBe(1000);
    expect(allowance.alreadySentToday).toBe(300);
    expect(allowance.remainingToday).toBe(700);
  });

  it('REFUSES when the account is suspended — this is the worker gate', async () => {
    // §5, FASE 1 item 6: "status = SUSPENDED → workers recusam envio".
    const account = makeAccount();
    account.suspend('Sinais de abuso recorrentes', 'admin-1');
    accounts.findById.mockResolvedValue(account);

    await expect(
      useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID, 1)),
    ).rejects.toThrow(AccountSuspendedException);
  });

  it('tells the suspended tenant the reason', async () => {
    const account = makeAccount();
    account.suspend('Sinais de abuso recorrentes', 'admin-1');
    accounts.findById.mockResolvedValue(account);

    await expect(useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID))).rejects.toThrow(
      /Sinais de abuso recorrentes/,
    );
  });

  it('refuses a suspended account even when asked for zero sends', async () => {
    const account = makeAccount();
    account.suspend('motivo', 'admin-1');
    accounts.findById.mockResolvedValue(account);

    // A read of the allowance must not look "fine" for a suspended tenant.
    await expect(
      useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID, 0)),
    ).rejects.toThrow(AccountSuspendedException);
  });

  it('accepts a plan that fits the account ceiling', async () => {
    accounts.findById.mockResolvedValue(makeAccount(1000));
    usage.totalSentToday.mockResolvedValue(200);

    await expect(
      useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID, 800)),
    ).resolves.toMatchObject({ remainingToday: 800 });
  });

  it('REFUSES a plan above the account ceiling instead of truncating it', async () => {
    accounts.findById.mockResolvedValue(makeAccount(1000));
    usage.totalSentToday.mockResolvedValue(200);

    await expect(
      useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID, 801)),
    ).rejects.toThrow(DailyCeilingExceededException);
  });

  it('measures usage in the account timezone', async () => {
    accounts.findById.mockResolvedValue(makeAccount());

    await useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID));

    expect(usage.totalSentToday).toHaveBeenCalledWith(expect.any(String), 'America/Sao_Paulo');
  });

  it('throws not-found for an unknown account', async () => {
    accounts.findById.mockResolvedValue(null);

    await expect(useCase.execute(new EnsureAccountCanDispatchCommand(ACCOUNT_ID))).rejects.toThrow(
      AccountNotFoundException,
    );
  });
});
