import { ConfigService } from '@nestjs/config';
import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { AccountNotFoundException } from '../../../src/contexts/account/domain/exceptions/account-not-found.exception';
import { EvolutionServerResolver } from '../../../src/infrastructure/whatsapp/evolution-server-resolver.service';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { InvalidPhoneNumberException } from '../../../src/shared/domain/exceptions/invalid-phone-number.exception';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function makeAccount(dedicated?: { url: string; key: string }): Account {
  const account = Account.create({
    name: 'Gabinete',
    document: Document.create('11144477735'),
    plan: AccountPlan.STANDARD,
    dailySendCeiling: 500,
    timezone: 'America/Sao_Paulo',
  });
  if (dedicated) {
    account.assignEvolutionServer(dedicated.url, dedicated.key);
  }
  return account;
}

function build(account: Account | null, env: Record<string, string> = {}) {
  const accounts = {
    findById: jest.fn(async () => account),
    existsByDocument: jest.fn(),
    save: jest.fn(),
    listForPlatform: jest.fn(),
  } as unknown as jest.Mocked<AccountRepositoryPort>;
  const config = {
    get: <T>(key: string): T | undefined => env[key] as T | undefined,
  } as ConfigService;
  return { resolver: new EvolutionServerResolver(accounts, config), accounts };
}

/**
 * §14, decisão 7: one shared platform server on v1, but the destination is resolved PER ACCOUNT so
 * moving a heavy or risky tenant to a dedicated server is one row, not a refactor.
 */
describe('EvolutionServerResolver', () => {
  it('falls back to the platform server when the account has none', async () => {
    const { resolver } = build(makeAccount(), {
      EVOLUTION_API_URL: 'https://evo.plataforma.com.br',
      EVOLUTION_API_KEY: 'platform-key',
    });

    const server = await resolver.resolve(ACCOUNT_ID);

    expect(server).toEqual({
      baseUrl: 'https://evo.plataforma.com.br',
      apiKey: 'platform-key',
      dedicated: false,
    });
  });

  it('uses the dedicated server when the account has one', async () => {
    const { resolver } = build(
      makeAccount({ url: 'https://evo-tenant.com.br/', key: 'tenant-key' }),
      { EVOLUTION_API_URL: 'https://evo.plataforma.com.br', EVOLUTION_API_KEY: 'platform-key' },
    );

    const server = await resolver.resolve(ACCOUNT_ID);

    // Trailing slash normalised so path concatenation never doubles it.
    expect(server).toEqual({
      baseUrl: 'https://evo-tenant.com.br',
      apiKey: 'tenant-key',
      dedicated: true,
    });
  });

  it('caches the resolution so it is not a query per message', async () => {
    const { resolver, accounts } = build(makeAccount(), {
      EVOLUTION_API_URL: 'https://evo.plataforma.com.br',
      EVOLUTION_API_KEY: 'platform-key',
    });

    await resolver.resolve(ACCOUNT_ID);
    await resolver.resolve(ACCOUNT_ID);
    await resolver.resolve(ACCOUNT_ID);

    expect(accounts.findById).toHaveBeenCalledTimes(1);
  });

  it('invalidate() makes the next send use the new destination', async () => {
    const { resolver, accounts } = build(makeAccount(), {
      EVOLUTION_API_URL: 'https://evo.plataforma.com.br',
      EVOLUTION_API_KEY: 'platform-key',
    });
    await resolver.resolve(ACCOUNT_ID);

    resolver.invalidate(ACCOUNT_ID);
    await resolver.resolve(ACCOUNT_ID);

    expect(accounts.findById).toHaveBeenCalledTimes(2);
  });

  it('fails with an explicit message when nothing is configured', async () => {
    const { resolver } = build(makeAccount(), {});

    await expect(resolver.resolve(ACCOUNT_ID)).rejects.toThrow(/EVOLUTION_API_URL/);
  });

  it('a URL without a key does NOT count as dedicated', async () => {
    // A URL with no key would fail at the first send, in the worst possible place.
    const account = makeAccount();
    account.assignEvolutionServer('https://evo-tenant.com.br', null);
    const { resolver } = build(account, {
      EVOLUTION_API_URL: 'https://evo.plataforma.com.br',
      EVOLUTION_API_KEY: 'platform-key',
    });

    const server = await resolver.resolve(ACCOUNT_ID);

    expect(server.dedicated).toBe(false);
  });

  it('throws not-found for an unknown account', async () => {
    const { resolver } = build(null, {});

    await expect(resolver.resolve(ACCOUNT_ID)).rejects.toThrow(AccountNotFoundException);
  });
});

describe('PhoneE164', () => {
  it('normalises what a Brazilian operator actually types', () => {
    const expected = '+5511999998888';

    expect(PhoneE164.create('11999998888').value).toBe(expected);
    expect(PhoneE164.create('(11) 99999-8888').value).toBe(expected);
    expect(PhoneE164.create('5511999998888').value).toBe(expected);
    expect(PhoneE164.create('+55 11 99999-8888').value).toBe(expected);
  });

  it('keeps an international number as given', () => {
    expect(PhoneE164.create('+1 202 555 0143').value).toBe('+12025550143');
  });

  it('accepts a landline (10 digits) as well as a mobile', () => {
    expect(PhoneE164.create('1133334444').value).toBe('+551133334444');
  });

  it('exposes digits without the plus, which is what a JID needs', () => {
    expect(PhoneE164.create('11999998888').digits).toBe('5511999998888');
  });

  it('masks for logs and DTOs — a full number is personal data', () => {
    expect(PhoneE164.create('11999998888').masked).toBe('+5511*****8888');
  });

  it('rejects junk', () => {
    expect(() => PhoneE164.create('')).toThrow(InvalidPhoneNumberException);
    expect(() => PhoneE164.create('123')).toThrow(InvalidPhoneNumberException);
    expect(() => PhoneE164.create('abcdefghij')).toThrow(InvalidPhoneNumberException);
    expect(() => PhoneE164.create('+0 11 99999-8888')).toThrow(InvalidPhoneNumberException);
  });

  it('two spellings of the same number are the same value', () => {
    // The whole "one contact, one sender" rule depends on chip and contact numbers matching exactly.
    expect(PhoneE164.create('(11) 99999-8888').equals(PhoneE164.create('+5511999998888'))).toBe(
      true,
    );
  });
});
