import { Distribution } from '../../domain/entities/distribution.entity';
import { DistributionStatus } from '../../domain/value-objects/distribution-status.vo';
import { BlockedReason } from '../../domain/value-objects/dispatch-status.vo';
import { BindingConstraint } from '../../domain/services/schedule-builder';

export class DistributionDto {
  id!: string;
  contentId!: string;
  contentTitle!: string;
  status!: DistributionStatus;
  windowStart!: Date;
  windowEnd!: Date;
  tags!: string[];
  createdBy!: string;
  confirmedAt!: Date | null;
  completedAt!: Date | null;
  createdAt!: Date;

  static fromDomain(distribution: Distribution, contentTitle: string): DistributionDto {
    const dto = new DistributionDto();
    dto.id = distribution.id;
    dto.contentId = distribution.contentId;
    dto.contentTitle = contentTitle;
    dto.status = distribution.status;
    dto.windowStart = distribution.window.start;
    dto.windowEnd = distribution.window.end;
    dto.tags = distribution.targetFilter.tags;
    dto.createdBy = distribution.createdBy;
    dto.confirmedAt = distribution.confirmedAt;
    dto.completedAt = distribution.completedAt;
    dto.createdAt = distribution.createdAt;
    return dto;
  }
}

/** One blocked item, with the reason. §9.3 requires the reason PER ITEM, not a total. */
export class BlockedItemDto {
  contactId!: string;
  /** Masked: a preview screen is not a place to print phone numbers. */
  phoneMasked!: string;
  contactName!: string | null;
  reason!: BlockedReason;
  /** Human sentence naming the actual obstacle, e.g. which channel is down. */
  detail!: string;
}

export class ChannelLoadDto {
  channelId!: string;
  channelLabel!: string;
  /** Sends assigned to this channel across the whole window. */
  scheduled!: number;
  /** Contacts that did not fit inside the window. */
  overflow!: number;
  /** Quota the channel will consume on the first day of the plan. */
  firstDayLoad!: number;
  /** `channels.current_quota` at planning time. */
  dailyQuota!: number;
  /** Campaign allowance after the reply reserve — what the campaign may actually use. */
  campaignAllowance!: number;
  alreadySentToday!: number;
}

export class VariantLoadDto {
  variantId!: string | null;
  label!: string;
  contacts!: number;
  /** How many of those came from the manual variant↔tag mapping rather than the even split. */
  fromManualMapping!: number;
}

export class RenderedSampleDto {
  contactName!: string | null;
  label!: string;
  renderedBody!: string;
  usedFallback!: boolean;
}

export class DailyLoadDto {
  /** `YYYY-MM-DD` in the account's timezone. */
  date!: string;
  scheduled!: number;
  accountCapacity!: number;
}

/**
 * The mandatory preview (§9.3).
 *
 * Every field here answers a question the operator must be able to answer BEFORE confirming, and the
 * uncomfortable ones are first-class rather than buried: what does not fit (`overflowCount`), who will
 * not receive it (`blocked`), and how many people will be greeted by the fallback instead of their
 * name (`fallbackCount`).
 */
export class DistributionPreviewDto {
  /** Null on a dry run: nothing was persisted. */
  distributionId!: string | null;
  contentId!: string;
  contentTitle!: string;
  contentHash!: string;
  classification!: string;
  status!: DistributionStatus | null;
  windowStart!: Date;
  windowEnd!: Date;
  timeZone!: string;

  /** Contacts the filter matched, before any exclusion. */
  audienceMatched!: number;
  /** Excluded for being inactive or opted out — never sent, never counted as blocked (§9.1). */
  excludedOptedOut!: number;
  excludedInactive!: number;
  /** Sends actually scheduled. */
  scheduledCount!: number;
  /** Matched, sendable, but did not fit in the window. NEVER truncated silently (§9.2). */
  overflowCount!: number;
  blockedCount!: number;

  /** "Estimativa de conclusão em dias" (§9.3). */
  estimatedDays!: number;
  firstSendAt!: Date | null;
  lastSendAt!: Date | null;

  perChannel!: ChannelLoadDto[];
  perVariant!: VariantLoadDto[];
  perDay!: DailyLoadDto[];
  blocked!: BlockedItemDto[];

  /** How many contacts will render the merge-field fallback (§7.4, §9.3). */
  fallbackCount!: number;
  /** Three real renderings, one of them showing the fallback when there is one. */
  samples!: RenderedSampleDto[];

  /**
   * The file each body carries, when it carries one — one entry per sendable body ("Base" or a
   * variant label), and an empty list when the campaign is text only.
   *
   * On the preview because the attachment is half the message and used not to appear anywhere before
   * the send: the operator approved a post with an image and had no way to tell, at planning time,
   * whether the image was going with it.
   */
  attachments!: { label: string; kind: string; fileName: string }[];

  /**
   * Which of the five ceilings produced this estimate (Adendo 02 §3.2).
   *
   * Exposed as the raw value as well as the sentence, so a client can group or filter on it without
   * parsing prose.
   */
  bindingConstraint!: BindingConstraint;
  /** Sends the binding ceiling allowed on the FIRST day — not the steady-state throughput. */
  bindingCapacityFirstDay!: number;
  /** True when the remainder had nowhere to go because the window ended first. */
  bindingWindowExhausted!: boolean;
  /** The cause in plain Portuguese, with the number that produced it. */
  bindingReason!: string;

  /**
   * What the operator can do about an overflow — derived from the ceiling that actually bound.
   *
   * It used to be the same three suggestions regardless of cause, which is how "estender a janela" got
   * offered for a spent quota and "adicionar canais" for an account ceiling that makes new chips useless
   * (Adendo 02 §3.1).
   */
  overflowOptions!: string[];
}
