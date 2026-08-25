import {
  ChannelDto,
  ChannelHealthDto,
  QrCodeDto,
  WebhookDiagnosisDto,
} from '../../../../../contexts/channel/application/dto/channel.dto';

export class ChannelResponseDto {
  id!: string;
  label!: string;
  /** Masked: a full phone number is personal data and never crosses the HTTP boundary. */
  phoneMasked!: string;
  status!: string;
  canSend!: boolean;
  /** True only for terminal states — the UI must not offer migration for a disconnected chip. */
  allowsSenderMigration!: boolean;
  currentQuota!: number;
  quotaFloor!: number;
  quotaCeiling!: number;
  isWarmingUp!: boolean;
  warmupStartedAt!: string | null;
  consecutiveFailures!: number;
  lastSendAt!: string | null;
  lastQuotaReviewAt!: string | null;
  disconnectEventsToday!: number;
  retiredAt!: string | null;
  terminalReason!: string | null;
  createdAt!: string;

  static from(channel: ChannelDto): ChannelResponseDto {
    const dto = new ChannelResponseDto();
    dto.id = channel.id;
    dto.label = channel.label;
    dto.phoneMasked = channel.phoneMasked;
    dto.status = channel.status;
    dto.canSend = channel.canSend;
    dto.allowsSenderMigration = channel.allowsSenderMigration;
    dto.currentQuota = channel.currentQuota;
    dto.quotaFloor = channel.quotaFloor;
    dto.quotaCeiling = channel.quotaCeiling;
    dto.isWarmingUp = channel.isWarmingUp;
    dto.warmupStartedAt = channel.warmupStartedAt?.toISOString() ?? null;
    dto.consecutiveFailures = channel.consecutiveFailures;
    dto.lastSendAt = channel.lastSendAt?.toISOString() ?? null;
    dto.lastQuotaReviewAt = channel.lastQuotaReviewAt?.toISOString() ?? null;
    dto.disconnectEventsToday = channel.disconnectEventsToday;
    dto.retiredAt = channel.retiredAt?.toISOString() ?? null;
    dto.terminalReason = channel.terminalReason;
    dto.createdAt = channel.createdAt.toISOString();
    return dto;
  }
}

export class QrCodeResponseDto {
  status!: string;
  /** Empty while provisioning, or once already connected. The UI polls until it fills or clears. */
  qrCodeBase64!: string;
  pairingCode!: string | null;

  static from(qr: QrCodeDto): QrCodeResponseDto {
    const dto = new QrCodeResponseDto();
    dto.status = qr.status;
    dto.qrCodeBase64 = qr.qrCodeBase64;
    dto.pairingCode = qr.pairingCode;
    return dto;
  }
}

/** The health panel (§2.1 item 6). */
export class ChannelHealthResponseDto {
  channel!: ChannelResponseDto;
  sendsPerDay!: { date: string; campaignSends: number; replySends: number; total: number }[];
  throttleHistory!: {
    date: string;
    decision: string;
    reason: string;
    computedQuota: number;
    sentCount: number;
    deliveryRate: number | null;
    failureRate: number | null;
    optOutRate: number | null;
    inboundRate: number | null;
    disconnectEvents: number;
  }[];
  windowMetrics!: ChannelHealthDto['windowMetrics'];
  connectionUptimeRate!: number | null;

  static from(health: ChannelHealthDto): ChannelHealthResponseDto {
    const dto = new ChannelHealthResponseDto();
    dto.channel = ChannelResponseDto.from(health.channel);
    dto.sendsPerDay = health.sendsPerDay;
    dto.throttleHistory = health.throttleHistory.map((row) => ({ ...row }));
    dto.windowMetrics = health.windowMetrics;
    dto.connectionUptimeRate = health.connectionUptimeRate;
    return dto;
  }
}

export class WebhookDiagnosisResponseDto {
  channelId!: string;
  channelLabel!: string;
  reconfigured!: boolean | null;
  configured!: boolean;
  enabled!: boolean;
  url!: string | null;
  events!: string[];
  hasAuthHeader!: boolean;
  receivesInbound!: boolean;
  receivesAcks!: boolean;
  /** O resto da cadeia, depois do POST — ver WebhookDiagnosisDto. */
  instanceName!: string;
  instanceNameAttributable!: boolean;
  inboundCount!: number;
  lastInboundAt!: string | null;
  contactsTotal!: number;
  contactsWithoutNinthDigit!: number;
  invalidTokenRejections!: number;
  lastInvalidTokenAt!: string | null;
  problem!: string | null;

  static from(dto: WebhookDiagnosisDto): WebhookDiagnosisResponseDto {
    const response = new WebhookDiagnosisResponseDto();
    response.channelId = dto.channelId;
    response.channelLabel = dto.channelLabel;
    response.reconfigured = dto.reconfigured;
    response.configured = dto.configured;
    response.enabled = dto.enabled;
    response.url = dto.url;
    response.events = dto.events;
    // Só a presença do cabeçalho. O token é o segredo que autentica o webhook.
    response.hasAuthHeader = dto.hasAuthHeader;
    response.receivesInbound = dto.receivesInbound;
    response.receivesAcks = dto.receivesAcks;
    response.instanceName = dto.instanceName;
    response.instanceNameAttributable = dto.instanceNameAttributable;
    response.inboundCount = dto.inboundCount;
    response.lastInboundAt = dto.lastInboundAt?.toISOString() ?? null;
    response.contactsTotal = dto.contactsTotal;
    response.contactsWithoutNinthDigit = dto.contactsWithoutNinthDigit;
    response.invalidTokenRejections = dto.invalidTokenRejections;
    response.lastInvalidTokenAt = dto.lastInvalidTokenAt?.toISOString() ?? null;
    response.problem = dto.problem;
    return response;
  }
}
