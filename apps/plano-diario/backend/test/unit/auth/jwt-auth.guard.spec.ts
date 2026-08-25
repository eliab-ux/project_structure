import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from '../../../src/infrastructure/security/guards/admin.guard';
import { JwtAuthGuard } from '../../../src/infrastructure/security/guards/jwt-auth.guard';
import {
  AuthTokenPayload,
  TokenServicePort,
} from '../../../src/infrastructure/security/ports/token-service.port';

function contextWith(authorization?: string): { context: ExecutionContext; request: any } {
  const request: any = { headers: authorization ? { authorization } : {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function tokenServiceFor(payload: Partial<AuthTokenPayload>): jest.Mocked<TokenServicePort> {
  return {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn().mockResolvedValue(payload),
    verifyRefreshToken: jest.fn(),
  };
}

describe('JwtAuthGuard', () => {
  it('token válido popula request.user', async () => {
    const payload = { sub: 'user-1', email: 'e@x.com', role: 'user' as const };
    const guard = new JwtAuthGuard(tokenServiceFor(payload));
    const { context, request } = contextWith('Bearer token-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  it('sem header Authorization → 401', async () => {
    const guard = new JwtAuthGuard(tokenServiceFor({}));
    await expect(guard.canActivate(contextWith().context)).rejects.toThrow(UnauthorizedException);
  });

  it('esquema diferente de Bearer → 401', async () => {
    const guard = new JwtAuthGuard(tokenServiceFor({}));
    const { context } = contextWith('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(context)).rejects.toThrow('Token ausente');
  });

  it('token inválido → 401 com mensagem genérica', async () => {
    const tokenService = tokenServiceFor({});
    tokenService.verifyAccessToken.mockRejectedValue(new Error('jwt expired'));
    const guard = new JwtAuthGuard(tokenService);
    const { context } = contextWith('Bearer expirado');

    // A mensagem não distingue expirado de malformado — não entrega pista ao atacante.
    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido ou expirado');
  });
});

describe('AdminGuard', () => {
  it('role admin passa', async () => {
    const guard = new AdminGuard(
      tokenServiceFor({ sub: 'u1', email: 'a@x.com', role: 'admin' as const }),
    );
    const { context } = contextWith('Bearer token-admin');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('role user em rota admin → 403', async () => {
    const guard = new AdminGuard(
      tokenServiceFor({ sub: 'u1', email: 'u@x.com', role: 'user' as const }),
    );
    const { context } = contextWith('Bearer token-user');
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('sem token em rota admin → 401 (autenticação antes de autorização)', async () => {
    const guard = new AdminGuard(tokenServiceFor({}));
    await expect(guard.canActivate(contextWith().context)).rejects.toThrow(UnauthorizedException);
  });
});
