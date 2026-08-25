import { EntityManager } from '@mikro-orm/core';
import { AuditLog } from '../../../src/contexts/audit/domain/entities/audit-log.entity';
import {
  AuditAction,
  AuditActorType,
} from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { MikroOrmAuditLogRepository } from '../../../src/infrastructure/persistence/mikro-orm/repositories/audit-log.repository';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';

describe('AuditLog', () => {
  it('records the action with the actor and the tenant', () => {
    const log = AuditLog.record({
      accountId: ACCOUNT_A,
      actorType: AuditActorType.USER,
      actorId: 'user-1',
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: 'user-1',
      ip: '10.0.0.1',
    });

    expect(log.accountId).toBe(ACCOUNT_A);
    expect(log.action).toBe(AuditAction.USER_LOGIN);
    expect(log.createdAt).toBeInstanceOf(Date);
    expect(log.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a null accountId for platform-level actions', () => {
    const log = AuditLog.record({
      accountId: null,
      actorType: AuditActorType.PLATFORM_ADMIN,
      actorId: 'admin-1',
      action: AuditAction.PLATFORM_ADMIN_LOGIN,
    });

    expect(log.accountId).toBeNull();
  });

  describe('payload sanitization', () => {
    it('redacts secrets and personal data at construction', () => {
      const log = AuditLog.record({
        accountId: ACCOUNT_A,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: AuditAction.USER_LOGIN,
        payload: {
          password: 'senha-secreta',
          token: 'eyJhbGciOi',
          apiKey: 'evolution-key',
          cpf: '11144477735',
          phoneE164: '+5511999999999',
          body: 'texto da mensagem enviada',
          reason: 'invalid_password',
        },
      });

      expect(log.payload.password).toBe('[REDACTED]');
      expect(log.payload.token).toBe('[REDACTED]');
      expect(log.payload.apiKey).toBe('[REDACTED]');
      expect(log.payload.cpf).toBe('[REDACTED]');
      expect(log.payload.phoneE164).toBe('[REDACTED]');
      expect(log.payload.body).toBe('[REDACTED]');
      // Non-sensitive context survives — the trail still has to be useful.
      expect(log.payload.reason).toBe('invalid_password');
    });

    it('redacts nested values too', () => {
      const log = AuditLog.record({
        accountId: ACCOUNT_A,
        actorType: AuditActorType.PLATFORM_ADMIN,
        actorId: 'admin-1',
        action: AuditAction.ACCOUNT_EVOLUTION_SERVER_CHANGED,
        payload: { server: { host: 'evo.example.com', apiKey: 'super-secret' } },
      });

      expect(log.payload.server).toEqual({ host: 'evo.example.com', apiKey: '[REDACTED]' });
    });

    it('sanitization cannot be bypassed by the caller', () => {
      const payload = { password: 'x' };
      const log = AuditLog.record({
        accountId: ACCOUNT_A,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: AuditAction.USER_LOGIN,
        payload,
      });

      // The stored payload is a sanitized copy — mutating the original afterwards changes nothing.
      payload.password = 'y';
      expect(log.payload.password).toBe('[REDACTED]');
    });
  });

  it('has no setters — the entity is immutable once recorded', () => {
    const log = AuditLog.record({
      accountId: ACCOUNT_A,
      actorType: AuditActorType.USER,
      actorId: 'user-1',
      action: AuditAction.USER_LOGIN,
    });

    const mutators = Object.getOwnPropertyNames(Object.getPrototypeOf(log)).filter((name) =>
      /^(set|update|change|delete|remove)/i.test(name),
    );
    expect(mutators).toEqual([]);
  });
});

describe('MikroOrmAuditLogRepository', () => {
  it('exposes append and nothing else — the trail is append-only (§1.6)', () => {
    const methods = Object.getOwnPropertyNames(MikroOrmAuditLogRepository.prototype).filter(
      (name) => name !== 'constructor',
    );

    // Adding update/delete here is a spec violation, and this assertion is what catches it.
    expect(methods).toEqual(['append']);
  });

  it('inserts, never upserts or updates', async () => {
    const insert = jest.fn();
    const em = { insert, upsert: jest.fn(), nativeUpdate: jest.fn(), flush: jest.fn() };
    const repository = new MikroOrmAuditLogRepository(em as unknown as EntityManager);

    await repository.append(
      AuditLog.record({
        accountId: ACCOUNT_A,
        actorType: AuditActorType.USER,
        actorId: 'user-1',
        action: AuditAction.USER_LOGIN,
      }),
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(em.upsert).not.toHaveBeenCalled();
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
});
