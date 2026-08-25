import { SenderMigration } from '../../../src/contexts/audience/domain/entities/sender-migration.entity';
import {
  MigrationStatus,
  MigrationStrategy,
} from '../../../src/contexts/audience/domain/value-objects/migration-strategy.vo';
import {
  InvalidMigrationTargetException,
  MigrationNotEligibleException,
} from '../../../src/contexts/audience/domain/exceptions/migration-not-eligible.exception';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const FROM = 'aaaaaaaa-1111-4111-8111-111111111111';
const TO = 'bbbbbbbb-1111-4111-8111-111111111111';
const ADMIN = 'cccccccc-1111-4111-8111-111111111111';

function plan(
  overrides: Partial<{
    status: ChannelStatus;
    strategy: MigrationStrategy;
    toChannelId: string | null;
  }> = {},
): SenderMigration {
  return SenderMigration.plan({
    accountId: ACCOUNT_ID,
    fromChannelId: FROM,
    fromChannelStatus: overrides.status ?? ChannelStatus.BANNED,
    strategy: overrides.strategy ?? MigrationStrategy.REDISTRIBUTE,
    toChannelId: overrides.toChannelId ?? null,
    requestedBy: ADMIN,
    approvedBy: ADMIN,
  });
}

/**
 * §6.4 item 1 is the rule this whole entity exists to enforce: only a TERMINAL source channel may be
 * migrated away from. "Migrar 100 contatos porque alguém deixou o celular sem bateria é irreversível
 * na prática."
 */
describe('SenderMigration — eligibility', () => {
  it.each([ChannelStatus.BANNED, ChannelStatus.RETIRED])('allows a %s source', (status) => {
    expect(() => plan({ status })).not.toThrow();
  });

  it.each([
    ChannelStatus.CONNECTED,
    ChannelStatus.DISCONNECTED,
    ChannelStatus.DEGRADED,
    ChannelStatus.AWAITING_QR,
    ChannelStatus.PROVISIONING,
  ])('REFUSES a %s source', (status) => {
    expect(() => plan({ status })).toThrow(MigrationNotEligibleException);
  });

  it('explains WHY a disconnected channel is refused, rather than just refusing', () => {
    // The operator staring at a chip that will not send genuinely believes migrating is the fix.
    expect(() => plan({ status: ChannelStatus.DISCONNECTED })).toThrow(/Desconexão é transitória/);
    expect(() => plan({ status: ChannelStatus.DISCONNECTED })).toThrow(/irreversível/);
  });
});

describe('SenderMigration — strategies (§6.4 item 2)', () => {
  it('ALL_TO_ONE demands a destination', () => {
    expect(() => plan({ strategy: MigrationStrategy.ALL_TO_ONE, toChannelId: null })).toThrow(
      InvalidMigrationTargetException,
    );
  });

  it('ALL_TO_ONE refuses the source as destination', () => {
    expect(() => plan({ strategy: MigrationStrategy.ALL_TO_ONE, toChannelId: FROM })).toThrow(
      /não pode ser o próprio canal de origem/,
    );
  });

  it('ALL_TO_ONE accepts a different destination', () => {
    const migration = plan({ strategy: MigrationStrategy.ALL_TO_ONE, toChannelId: TO });

    expect(migration.toChannelId).toBe(TO);
  });

  it('REDISTRIBUTE refuses a destination — the distribution is computed, not chosen', () => {
    expect(() => plan({ strategy: MigrationStrategy.REDISTRIBUTE, toChannelId: TO })).toThrow(
      /não recebe canal de destino/,
    );
  });

  it('REDISTRIBUTE plans with no destination', () => {
    const migration = plan({ strategy: MigrationStrategy.REDISTRIBUTE });

    expect(migration.toChannelId).toBeNull();
    expect(migration.strategy).toBe(MigrationStrategy.REDISTRIBUTE);
  });
});

describe('SenderMigration — lifecycle', () => {
  it('starts PLANNED with the approval recorded (§6.4 item 4)', () => {
    const migration = plan();

    expect(migration.status).toBe(MigrationStatus.PLANNED);
    expect(migration.requestedBy).toBe(ADMIN);
    // v1: the ACCOUNT_ADMIN who executes IS the recorded human approval.
    expect(migration.approvedBy).toBe(ADMIN);
    expect(migration.executedAt).toBeNull();
    expect(migration.contactsAffected).toBe(0);
  });

  it('records how many contacts actually moved', () => {
    const migration = plan();

    migration.markExecuted(137);

    expect(migration.status).toBe(MigrationStatus.EXECUTED);
    expect(migration.contactsAffected).toBe(137);
    expect(migration.executedAt).toBeInstanceOf(Date);
  });

  it('records a failure with its reason', () => {
    const migration = plan();

    migration.markFailed('canal de destino ficou indisponível no meio da execução');

    expect(migration.status).toBe(MigrationStatus.FAILED);
    expect(migration.failureReason).toMatch(/indisponível/);
  });

  it('truncates an over-long failure reason instead of overflowing the column', () => {
    const migration = plan();

    migration.markFailed('x'.repeat(900));

    expect(migration.failureReason).toHaveLength(500);
  });
});
