import { ForbiddenException } from '@nestjs/common';
import { resolveOwnerId } from '../../../src/shared/tenant/tenant';
import { AuthTokenPayload } from '../../../src/infrastructure/security/ports/token-service.port';

describe('resolveOwnerId (tenant isolation)', () => {
  it('returns the JWT sub as the owner id', () => {
    const payload = { sub: 'user-123', email: 'a@b.com', role: 'user' } as AuthTokenPayload;
    expect(resolveOwnerId(payload)).toBe('user-123');
  });

  it('never trusts a missing sub — throws Forbidden', () => {
    expect(() => resolveOwnerId({} as AuthTokenPayload)).toThrow(ForbiddenException);
    expect(() => resolveOwnerId(undefined as unknown as AuthTokenPayload)).toThrow(
      ForbiddenException,
    );
  });
});
