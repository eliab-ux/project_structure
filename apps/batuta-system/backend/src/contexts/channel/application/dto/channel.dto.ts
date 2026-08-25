import { Channel } from '../../domain/entities/channel.entity';
import { ChannelStatus, allowsSenderMigration } from '../../domain/value-objects/channel-status.vo';
import { ThrottleDecision } from '../../domain/value-objects/throttle-decision.vo';

/**
 * Application view of a channel. `phoneMasked` rather than the number: a full phone is personal
 * data, and the operator already knows which chip is which by its label.
 */
export class ChannelDto {
  id!: string;
  label!: string;
  phoneMasked!: string;
  status!: ChannelStatus;
  /** Whether this channel may send right now. Only CONNECTED can. */
  canSend!: boolean;
  /**
   * Whether this channel's contacts may be migrated (§6.4). True only for terminal states —
   * exposed so the UI never offers migration for a channel that is merely disconnected.
   */
  allowsSenderMigration!: boolean;
  currentQuota!: number;
  quotaFloor!: number;
  quotaCeiling!: number;
  isWarmingUp!: boolean;
  warmupStartedAt!: Date | null;
  consecutiveFailures!: number;
  lastSendAt!: Date | null;
  lastQuotaReviewAt!: Date | null;
  disconnectEventsToday!: number;
  retiredAt!: Date | null;
  terminalReason!: string | null;
  createdAt!: Date;

  static fromDomain(channel: Channel): ChannelDto {
    const dto = new ChannelDto();
    dto.id = channel.id.value;
    dto.label = channel.label;
    dto.phoneMasked = channel.phone.masked;
    dto.status = channel.status;
    dto.canSend = channel.canSend;
    dto.allowsSenderMigration = allowsSenderMigration(channel.status);
    dto.currentQuota = channel.quota.current;
    dto.quotaFloor = channel.quota.floor;
    dto.quotaCeiling = channel.quota.ceiling;
    dto.isWarmingUp = channel.isWarmingUp;
    dto.warmupStartedAt = channel.warmupStartedAt;
    dto.consecutiveFailures = channel.consecutiveFailures;
    dto.lastSendAt = channel.lastSendAt;
    dto.lastQuotaReviewAt = channel.lastQuotaReviewAt;
    dto.disconnectEventsToday = channel.disconnectEventsToday;
    dto.retiredAt = channel.retiredAt;
    dto.terminalReason = channel.terminalReason;
    dto.createdAt = channel.createdAt;
    // evolutionInstanceName is intentionally absent: it is infrastructure detail, and knowing it
    // is the first step to poking at the shared Evolution server.
    return dto;
  }
}

export class QrCodeDto {
  status!: ChannelStatus;
  /** Empty while the instance is still provisioning; the UI polls. */
  qrCodeBase64!: string;
  pairingCode!: string | null;
}

export class ThrottleDecisionHistoryDto {
  date!: string;
  decision!: ThrottleDecision;
  reason!: string;
  computedQuota!: number;
  sentCount!: number;
  deliveryRate!: number | null;
  failureRate!: number | null;
  optOutRate!: number | null;
  inboundRate!: number | null;
  disconnectEvents!: number;
}

/** The health panel (§2.1 item 6). */
export class ChannelHealthDto {
  channel!: ChannelDto;
  /** Real risk metric: what the chip actually sent per day, not what it was allowed to. */
  sendsPerDay!: { date: string; campaignSends: number; replySends: number; total: number }[];
  throttleHistory!: ThrottleDecisionHistoryDto[];
  windowMetrics!: {
    daysConsidered: number;
    sentCount: number;
    deliveryRate: number | null;
    failureRate: number | null;
    optOutRate: number | null;
    inboundRate: number | null;
    disconnectEvents: number;
  };
  /** Percentage of the window in which the connection was up, from disconnect events. */
  connectionUptimeRate!: number | null;
}

/**
 * What the provider actually has configured for a channel's instance.
 *
 * `problem` carries the diagnosis in plain language: the raw fields only mean something to someone who
 * already knows what should be there, and the person staring at an empty inbox usually does not.
 */
export class WebhookDiagnosisDto {
  channelId!: string;
  channelLabel!: string;
  /** Null when the caller only read; true/false when it asked to reconfigure first. */
  reconfigured!: boolean | null;
  configured!: boolean;
  enabled!: boolean;
  url!: string | null;
  events!: string[];
  /** Presence only — the token that authenticates the webhook never leaves the backend. */
  hasAuthHeader!: boolean;
  receivesInbound!: boolean;
  receivesAcks!: boolean;

  // ---- beyond the provider: the rest of the chain ------------------------------------------------
  //
  // Everything above describes what the PROVIDER has configured. All of it can be green while no reply
  // ever reaches the inbox, and that state is what sends people digging through container logs. The
  // fields below are the links after the POST.

  /** The Evolution instance of this channel. Not a secret: it embeds ids its own admin already has. */
  instanceName!: string;
  /**
   * Whether the instance name still matches `acct-{account}-ch-{channel}`.
   *
   * This is how an inbound learns WHICH TENANT it belongs to — from a name we generated, never from the
   * payload body, which a holder of the shared token could otherwise aim at any account. So a name that
   * does not parse means every inbound from this chip is discarded before anything else runs, and
   * reconfiguring the webhook cannot fix it.
   */
  instanceNameAttributable!: boolean;
  /** Inbound ever recorded for this channel. Zero with everything else green is the real finding. */
  inboundCount!: number;
  lastInboundAt!: Date | null;
  contactsTotal!: number;
  /** Contacts of this channel missing the ninth digit — sending works, only the reply breaks. */
  contactsWithoutNinthDigit!: number;
  /** Calls refused for a bad token since the backend started. Proves the POSTs ARE arriving. */
  invalidTokenRejections!: number;
  lastInvalidTokenAt!: Date | null;

  problem!: string | null;
}
