import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthTokenPayload,
  TokenServicePort,
} from '../../../src/contexts/auth/application/ports/output/token-service.port';
import { UnauthorizedTokenException } from '../../../src/contexts/auth/domain/exceptions/invalid-token.exception';
import { JwtTokenService } from '../../../src/infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from '../../../src/infrastructure/security/guards/jwt-auth.guard';
import { AccountAdminGuard } from '../../../src/infrastructure/security/guards/account-admin.guard';
import { PlatformAdminGuard } from '../../../src/infrastructure/security/guards/platform-admin.guard';
import { TenantContextService } from '../../../src/infrastructure/security/tenant-context.service';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111';

function configWith(env: Record<string, string>): ConfigService {
  return { get: <T>(key: string): T | undefined => env[key] as T | undefined } as ConfigService;
}

function tokenService(): JwtTokenService {
  return new JwtTokenService(
    configWith({
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      NODE_ENV: 'test',
    }),
  );
}

function contextWith(headers: Record<string, string>): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; user?: AuthTokenPayload; platformAdmin?: unknown };
} {
  const request = { headers } as {
    headers: Record<string, string>;
    user?: AuthTokenPayload;
    platformAdmin?: unknown;
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

/** Records what scope the guard established, without needing a real EntityManager. */
function fakeTenantContext(): TenantContextService & { established: string[]; platform: number } {
  const established: string[] = [];
  let platform = 0;
  return {
    established,
    get platform() {
      return platform;
    },
    establish: (accountId: string) => established.push(accountId),
    establishPlatformScope: () => {
      platform += 1;
    },
    requireAccountId: () => established[established.length - 1],
    currentAccountId: () => established[established.length - 1] ?? null,
  } as unknown as TenantContextService & { established: string[]; platform: number };
}

describe('JwtAuthGuard', () => {
  let tokens: TokenServicePort;

  beforeEach(() => {
    tokens = tokenService();
  });

  it('rejects a request with no token (401)', () => {
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());
    const { context } = contextWith({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a malformed Authorization header (401)', () => {
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());

    expect(() => guard.canActivate(contextWith({ authorization: 'token abc' }).context)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(contextWith({ authorization: 'Bearer' }).context)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid token (401)', () => {
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());
    const { context } = contextWith({ authorization: 'Bearer not.a.jwt' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedTokenException);
  });

  it('rejects a token signed with another secret (401)', () => {
    const foreign = new JwtTokenService(
      configWith({
        JWT_ACCESS_SECRET: 'a-completely-different-secret-value',
        JWT_REFRESH_SECRET: 'another-different-secret-value',
        NODE_ENV: 'test',
      }),
    );
    const { accessToken } = foreign.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'OPERATOR',
    });
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${accessToken}` }).context),
    ).toThrow(UnauthorizedTokenException);
  });

  it('rejects a REFRESH token used as an access token (401)', () => {
    const { refreshToken } = tokens.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'ACCOUNT_ADMIN',
    });
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${refreshToken}` }).context),
    ).toThrow(UnauthorizedTokenException);
  });

  it('rejects a PLATFORM token on a tenant route (401)', () => {
    const { accessToken } = tokens.issueForPlatformAdmin({ sub: USER_A, scope: 'PLATFORM' });
    const guard = new JwtAuthGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${accessToken}` }).context),
    ).toThrow(UnauthorizedTokenException);
  });

  it('accepts a valid token AND establishes the tenant scope from it', () => {
    const { accessToken } = tokens.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'OPERATOR',
    });
    const tenantContext = fakeTenantContext();
    const guard = new JwtAuthGuard(tokens, tenantContext);
    const { context, request } = contextWith({ authorization: `Bearer ${accessToken}` });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ sub: USER_A, accountId: ACCOUNT_A, role: 'OPERATOR' });
    // The scope comes from the signed token — being authenticated and being scoped are one event.
    expect(tenantContext.established).toEqual([ACCOUNT_A]);
  });
});

describe('AccountAdminGuard', () => {
  let tokens: TokenServicePort;

  beforeEach(() => {
    tokens = tokenService();
  });

  it('rejects an OPERATOR on an ACCOUNT_ADMIN route (403)', () => {
    const { accessToken } = tokens.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'OPERATOR',
    });
    const guard = new AccountAdminGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${accessToken}` }).context),
    ).toThrow(ForbiddenException);
  });

  it('accepts an ACCOUNT_ADMIN', () => {
    const { accessToken } = tokens.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'ACCOUNT_ADMIN',
    });
    const tenantContext = fakeTenantContext();
    const guard = new AccountAdminGuard(tokens, tenantContext);

    expect(guard.canActivate(contextWith({ authorization: `Bearer ${accessToken}` }).context)).toBe(
      true,
    );
    // Still authenticates and still scopes — it does not assume JwtAuthGuard ran first.
    expect(tenantContext.established).toEqual([ACCOUNT_A]);
  });

  it('rejects a missing token with 401, not 403', () => {
    const guard = new AccountAdminGuard(tokens, fakeTenantContext());

    expect(() => guard.canActivate(contextWith({}).context)).toThrow(UnauthorizedException);
  });
});

describe('PlatformAdminGuard', () => {
  let tokens: TokenServicePort;

  beforeEach(() => {
    tokens = tokenService();
  });

  it('rejects a TENANT token, even an ACCOUNT_ADMIN one (401)', () => {
    const { accessToken } = tokens.issueForUser({
      sub: USER_A,
      accountId: ACCOUNT_A,
      role: 'ACCOUNT_ADMIN',
    });
    const guard = new PlatformAdminGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${accessToken}` }).context),
    ).toThrow(UnauthorizedTokenException);
  });

  it('accepts a platform token and establishes NO tenant scope', () => {
    const { accessToken } = tokens.issueForPlatformAdmin({ sub: USER_A, scope: 'PLATFORM' });
    const tenantContext = fakeTenantContext();
    const guard = new PlatformAdminGuard(tokens, tenantContext);
    const { context, request } = contextWith({ authorization: `Bearer ${accessToken}` });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.platformAdmin).toEqual({ sub: USER_A, scope: 'PLATFORM' });
    // No tenant scope: a platform request touching a business entity must break, not read all rows.
    expect(tenantContext.established).toEqual([]);
    expect(tenantContext.platform).toBe(1);
  });

  it('rejects a platform REFRESH token as an access token (401)', () => {
    const { refreshToken } = tokens.issueForPlatformAdmin({ sub: USER_A, scope: 'PLATFORM' });
    const guard = new PlatformAdminGuard(tokens, fakeTenantContext());

    expect(() =>
      guard.canActivate(contextWith({ authorization: `Bearer ${refreshToken}` }).context),
    ).toThrow(UnauthorizedTokenException);
  });
});
