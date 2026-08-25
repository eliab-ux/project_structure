import { randomUUID } from 'crypto';
import { AuditAction, AuditActorType } from '../value-objects/audit-action.vo';

/** Keys whose value is redacted before the payload is persisted. */
const SENSITIVE_KEYS =
  /^(password|passwordHash|senha|token|refreshToken|accessToken|secret|apiKey|authorization|cpf|cnpj|document|phone|phoneE164|body|message|renderedBody)$/i;

/**
 * One immutable line of the audit trail. Append-only: there is no setter, no update method and
 * the repository exposes no update/delete (BATUTA_SPEC §1.6).
 *
 * The payload is sanitized HERE, at construction, rather than trusting each caller to remember:
 * one place to audit means the trail cannot become the leak.
 */
export class AuditLog {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string | null,
    private readonly _actorType: AuditActorType,
    private readonly _actorId: string | null,
    private readonly _action: AuditAction,
    private readonly _entityType: string | null,
    private readonly _entityId: string | null,
    private readonly _payload: Record<string, unknown>,
    private readonly _ip: string | null,
    private readonly _createdAt: Date,
  ) {}

  static record(params: {
    /** Null only for platform-level actions that are not about one tenant. */
    accountId: string | null;
    actorType: AuditActorType;
    actorId: string | null;
    action: AuditAction;
    entityType?: string | null;
    entityId?: string | null;
    payload?: Record<string, unknown>;
    ip?: string | null;
  }): AuditLog {
    return new AuditLog(
      randomUUID(),
      params.accountId,
      params.actorType,
      params.actorId,
      params.action,
      params.entityType ?? null,
      params.entityId ?? null,
      AuditLog.sanitize(params.payload ?? {}),
      params.ip ?? null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string | null;
    actorType: AuditActorType;
    actorId: string | null;
    action: AuditAction;
    entityType: string | null;
    entityId: string | null;
    payload: Record<string, unknown>;
    ip: string | null;
    createdAt: Date;
  }): AuditLog {
    return new AuditLog(
      params.id,
      params.accountId,
      params.actorType,
      params.actorId,
      params.action,
      params.entityType,
      params.entityId,
      params.payload,
      params.ip,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string | null {
    return this._accountId;
  }

  get actorType(): AuditActorType {
    return this._actorType;
  }

  get actorId(): string | null {
    return this._actorId;
  }

  get action(): AuditAction {
    return this._action;
  }

  get entityType(): string | null {
    return this._entityType;
  }

  get entityId(): string | null {
    return this._entityId;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get ip(): string | null {
    return this._ip;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** Recursively replaces sensitive values with '[REDACTED]'. Depth-capped to avoid cycles. */
  private static sanitize(payload: Record<string, unknown>, depth = 0): Record<string, unknown> {
    if (depth > 4) {
      return {};
    }
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SENSITIVE_KEYS.test(key)) {
        clean[key] = '[REDACTED]';
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        clean[key] = AuditLog.sanitize(value as Record<string, unknown>, depth + 1);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }
}
