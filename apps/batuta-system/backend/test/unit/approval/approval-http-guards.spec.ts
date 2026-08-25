import { ExecutionContext, HttpException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EntityManager } from '@mikro-orm/core';
import { ApprovalRateLimitGuard } from '../../../src/infrastructure/http/guards/approval-rate-limit.guard';
import {
  ApprovalTokenParamDto,
  DecideApprovalRequestDto,
  UpdateApprovalSettingsRequestDto,
} from '../../../src/infrastructure/http/controllers/approval/dto/approval-request.dto';
import { ApprovalRequestResponseDto } from '../../../src/infrastructure/http/controllers/approval/dto/approval-response.dto';
import { ApprovalRequestDto } from '../../../src/contexts/approval/application/dto/approval.dto';
import { ApprovalRequest } from '../../../src/contexts/approval/domain/entities/approval-request.entity';
import {
  MikroOrmApprovalRequestRepository,
  MikroOrmApproverRepository,
} from '../../../src/infrastructure/persistence/mikro-orm/repositories/approval.repositories';
import { TENANT_FILTER } from '../../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function contextWith(ip: string, token?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, params: token ? { token } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApprovalRateLimitGuard (§8 item 4: rate limit por IP e por token)', () => {
  let guard: ApprovalRateLimitGuard;

  beforeEach(() => {
    guard = new ApprovalRateLimitGuard();
  });

  it('lets a normal approver through', () => {
    expect(guard.canActivate(contextWith('203.0.113.7', 'a'.repeat(43)))).toBe(true);
  });

  it('stops someone hammering ONE link', () => {
    const context = contextWith('203.0.113.7', 'a'.repeat(43));

    // The per-token budget (10) bites before the per-IP one (30).
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('stops someone spraying MANY tokens from one IP', () => {
    // Each token is fresh, so only the per-IP budget can catch this.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(guard.canActivate(contextWith('198.51.100.9', `t${attempt}`.padEnd(43, 'x')))).toBe(
        true,
      );
    }

    expect(() => guard.canActivate(contextWith('198.51.100.9', 'zzz'.padEnd(43, 'y')))).toThrow(
      /Muitas tentativas/,
    );
  });

  it('one abusive IP does not lock out a different approver', () => {
    const abusive = contextWith('203.0.113.7', 'a'.repeat(43));
    for (let attempt = 0; attempt < 11; attempt += 1) {
      try {
        guard.canActivate(abusive);
      } catch {
        // expected once the budget runs out
      }
    }

    expect(guard.canActivate(contextWith('192.0.2.50', 'b'.repeat(43)))).toBe(true);
  });

  it('answers with 429, not with a 4xx that reveals whether the token exists', () => {
    const context = contextWith('203.0.113.7', 'a'.repeat(43));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      guard.canActivate(context);
    }

    try {
      guard.canActivate(context);
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });
});

describe('Public route DTOs', () => {
  it('accepts a token of the shape this system issues', async () => {
    const dto = plainToInstance(ApprovalTokenParamDto, { token: 'a'.repeat(43) });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['too short', 'abc'],
    ['SQL-ish', "' OR 1=1 --"],
    ['a path traversal', '../../etc/passwd'],
    ['absurdly long', 'a'.repeat(5_000)],
  ])('rejects %s before it reaches the hash function', async (_label, token) => {
    const dto = plainToInstance(ApprovalTokenParamDto, { token });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('requires a decision of exactly APPROVE or REJECT', async () => {
    const bad = plainToInstance(DecideApprovalRequestDto, { decision: 'MAYBE' });
    expect(await validate(bad)).not.toHaveLength(0);

    const good = plainToInstance(DecideApprovalRequestDto, {
      decision: 'REJECT',
      comment: '  ajustar  ',
    });
    expect(await validate(good)).toHaveLength(0);
    expect(good.comment).toBe('ajustar');
  });

  it('refuses 3 required approvals at the HTTP edge as well as in the domain', async () => {
    const dto = plainToInstance(UpdateApprovalSettingsRequestDto, {
      requiredForInstitutional: 1,
      requiredForElectoral: 3,
      notifyChannel: 'EMAIL',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('ApprovalRequestResponseDto', () => {
  it('never carries the token hash nor the decision IP', () => {
    const { request } = ApprovalRequest.issue({
      accountId: ACCOUNT_ID,
      contentId: 'bbbbbbbb-1111-4111-8111-111111111111',
      contentHash: 'a'.repeat(64),
      approverId: 'cccccccc-1111-4111-8111-111111111111',
      ttlHours: 72,
    });
    request.approve({ ip: '203.0.113.7', userAgent: 'iPhone', comment: 'ok' });

    const response = ApprovalRequestResponseDto.from(ApprovalRequestDto.fromDomain(request, 'Ana'));
    const serialised = JSON.stringify(response);

    expect(serialised).not.toContain(request.tokenHashForPersistence());
    expect(serialised).not.toContain('203.0.113.7');
    expect(serialised).not.toContain('iPhone');
    // What the author does need: the version, the decision and the comment.
    expect(response.contentHash).toBe('a'.repeat(64));
    expect(response.comment).toBe('ok');
  });
});

describe('Approval repositories — tenant scoping', () => {
  let em: jest.Mocked<
    Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush' | 'nativeUpdate'>
  >;

  beforeEach(() => {
    em = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      upsert: jest.fn(),
      flush: jest.fn(),
      nativeUpdate: jest.fn(async () => 0),
    } as unknown as jest.Mocked<
      Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush' | 'nativeUpdate'>
    >;
  });

  it('findByTokenHashUnscoped is the ONE approval read that disables the filter', async () => {
    const repository = new MikroOrmApprovalRequestRepository(em as unknown as EntityManager);

    await repository.findByTokenHashUnscoped('a'.repeat(64));

    const [, , options] = em.findOne.mock.calls[0];
    // Unscoped by necessity: the approver has no JWT, so there is no tenant to filter by.
    expect(options?.filters).toEqual({ [TENANT_FILTER]: false });
  });

  it('every other approval query relies on the global filter', async () => {
    const requests = new MikroOrmApprovalRequestRepository(em as unknown as EntityManager);
    const approvers = new MikroOrmApproverRepository(em as unknown as EntityManager);

    await requests.findById('dddddddd-1111-4111-8111-111111111111');
    await requests.listForContent('bbbbbbbb-1111-4111-8111-111111111111');
    await requests.invalidatePendingForContent('bbbbbbbb-1111-4111-8111-111111111111');
    await approvers.listActive();
    await approvers.listAll();
    await approvers.findByEmail('ana@exemplo.com');

    const overrides = [...em.findOne.mock.calls, ...em.find.mock.calls]
      .map(([, , options]) => options?.filters)
      .filter(Boolean);
    expect(overrides).toEqual([]);

    // And no query smuggles an accountId of its own — the filter is the single source of scope.
    const wheres = [...em.findOne.mock.calls, ...em.find.mock.calls, ...em.nativeUpdate.mock.calls]
      .map(([, where]) => JSON.stringify(where))
      .join('|');
    expect(wheres).not.toContain('accountId');
  });

  it('a pending invalidation targets only PENDING rows — a recorded decision is never rewritten', async () => {
    const repository = new MikroOrmApprovalRequestRepository(em as unknown as EntityManager);

    await repository.invalidatePendingForContent('bbbbbbbb-1111-4111-8111-111111111111');

    const [, where, data] = em.nativeUpdate.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(where.status).toBe('PENDING');
    expect(data.status).toBe('INVALIDATED');
  });
});
