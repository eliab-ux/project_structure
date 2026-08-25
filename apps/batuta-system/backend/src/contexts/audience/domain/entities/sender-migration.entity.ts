import { randomUUID } from 'crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import {
  ChannelStatus,
  allowsSenderMigration,
} from '../../../channel/domain/value-objects/channel-status.vo';
import { MigrationStatus, MigrationStrategy } from '../value-objects/migration-strategy.vo';
import {
  InvalidMigrationTargetException,
  MigrationNotEligibleException,
} from '../exceptions/migration-not-eligible.exception';

/**
 * One sender migration (§6.4): the only path by which a contact changes chip.
 *
 * Eligibility is checked HERE, in the domain, not in the controller: only a terminal source channel
 * (BANNED or RETIRED) qualifies. `DISCONNECTED` is refused with an explanation, because that is the
 * mistake the spec spends a paragraph warning about — and it is irreversible in practice.
 *
 * `requested_by` and `approved_by` are both recorded. In v1 they are the same ACCOUNT_ADMIN: the
 * human who executes IS the approval the spec requires (§6.4 item 4). Keeping two columns means a
 * two-person flow can be added later without a migration.
 */
export class SenderMigration extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _fromChannelId: string,
    private readonly _strategy: MigrationStrategy,
    private readonly _toChannelId: string | null,
    private _contactsAffected: number,
    private readonly _requestedBy: string,
    private readonly _approvedBy: string,
    private _status: MigrationStatus,
    private _executedAt: Date | null,
    private _failureReason: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  /**
   * @param fromChannelStatus current status of the source channel — passed in rather than fetched so
   *        the entity stays pure while still owning the eligibility rule.
   */
  static plan(params: {
    accountId: string;
    fromChannelId: string;
    fromChannelStatus: ChannelStatus;
    strategy: MigrationStrategy;
    toChannelId: string | null;
    requestedBy: string;
    approvedBy: string;
  }): SenderMigration {
    if (!allowsSenderMigration(params.fromChannelStatus)) {
      throw new MigrationNotEligibleException(params.fromChannelStatus);
    }

    if (params.strategy === MigrationStrategy.ALL_TO_ONE) {
      if (!params.toChannelId) {
        throw new InvalidMigrationTargetException(
          'Estratégia ALL_TO_ONE exige um canal de destino.',
        );
      }
      if (params.toChannelId === params.fromChannelId) {
        throw new InvalidMigrationTargetException(
          'O canal de destino não pode ser o próprio canal de origem.',
        );
      }
    }

    if (params.strategy === MigrationStrategy.REDISTRIBUTE && params.toChannelId) {
      throw new InvalidMigrationTargetException(
        'Estratégia REDISTRIBUTE não recebe canal de destino: a distribuição é automática.',
      );
    }

    return new SenderMigration(
      randomUUID(),
      params.accountId,
      params.fromChannelId,
      params.strategy,
      params.toChannelId,
      0,
      params.requestedBy,
      params.approvedBy,
      MigrationStatus.PLANNED,
      null,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    fromChannelId: string;
    strategy: MigrationStrategy;
    toChannelId: string | null;
    contactsAffected: number;
    requestedBy: string;
    approvedBy: string;
    status: MigrationStatus;
    executedAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
  }): SenderMigration {
    return new SenderMigration(
      params.id,
      params.accountId,
      params.fromChannelId,
      params.strategy,
      params.toChannelId,
      params.contactsAffected,
      params.requestedBy,
      params.approvedBy,
      params.status,
      params.executedAt,
      params.failureReason,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get fromChannelId(): string {
    return this._fromChannelId;
  }

  get strategy(): MigrationStrategy {
    return this._strategy;
  }

  get toChannelId(): string | null {
    return this._toChannelId;
  }

  get contactsAffected(): number {
    return this._contactsAffected;
  }

  get requestedBy(): string {
    return this._requestedBy;
  }

  get approvedBy(): string {
    return this._approvedBy;
  }

  get status(): MigrationStatus {
    return this._status;
  }

  get executedAt(): Date | null {
    return this._executedAt;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  markExecuted(contactsAffected: number): void {
    this._contactsAffected = contactsAffected;
    this._status = MigrationStatus.EXECUTED;
    this._executedAt = new Date();
  }

  markFailed(reason: string): void {
    this._status = MigrationStatus.FAILED;
    this._failureReason = reason.slice(0, 500);
  }
}
