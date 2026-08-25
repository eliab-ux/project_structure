import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import {
  DAILY_SEND_USAGE,
  DailySendUsagePort,
} from '../../../../account/application/ports/output/daily-send-usage.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import { AccountSuspendedException } from '../../../../account/domain/exceptions/account-suspended.exception';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../../content/domain/exceptions/content-not-found.exception';
import { ContentNotSingleMessageException } from '../../../../content/domain/exceptions/content-not-single-message.exception';
import { findAttachmentProblems } from '../../../../content/domain/services/attachment-policy';
import { renderMergeFields } from '../../../../content/domain/services/merge-fields';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../../../audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../../audience/domain/entities/contact.entity';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import {
  CHANNEL_DAILY_COUNTER_REPOSITORY,
  ChannelDailyCounterRepositoryPort,
} from '../../../../channel/application/ports/output/channel-signals.port';
import { Channel } from '../../../../channel/domain/entities/channel.entity';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { DistributionConfig } from '../../../../../config/distribution.config';
import { localDateKey } from '../../../../../shared/domain/services/zoned-time';
import { Distribution } from '../../../domain/entities/distribution.entity';
import { Dispatch } from '../../../domain/entities/dispatch.entity';
import { DistributionWindow } from '../../../domain/value-objects/distribution-window.vo';
import { TargetFilter } from '../../../domain/value-objects/target-filter.vo';
import { BlockedReason } from '../../../domain/value-objects/dispatch-status.vo';
import { ContentNotDispatchableException } from '../../../domain/exceptions/content-not-dispatchable.exception';
import { EmptyAudienceException } from '../../../domain/exceptions/empty-audience.exception';
import { ChannelPlanInput, buildSchedule } from '../../../domain/services/schedule-builder';
import { explainBindingConstraint } from '../../../domain/services/binding-constraint-explainer';
import {
  VariantAssignment,
  assignVariants,
  summariseAssignments,
} from '../../../domain/services/variant-assignment';
import {
  BlockedItemDto,
  DistributionPreviewDto,
  RenderedSampleDto,
} from '../../dto/distribution.dto';
import {
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../ports/output/distribution-repositories.port';
import { PlanDistributionCommand } from './plan-distribution.command';

/** Enough of the base to plan a real campaign; beyond this the operator should segment by tag. */
const MAX_AUDIENCE = 50_000;
const SAMPLE_SIZE = 3;

/**
 * Resolves an audience, assigns variants, renders every message and schedules the whole thing (§9).
 *
 * The order is not arbitrary — each step depends on the previous one being settled:
 *
 *  1. **content must be APPROVED** (§1.4). Checked first because everything after it is wasted work
 *     if it fails.
 *  2. **account must be able to dispatch** — a SUSPENDED tenant does not get a plan (§5, FASE 1).
 *  3. **expand the filter**, dropping inactive and opted-out contacts. They are EXCLUDED, not blocked:
 *     §9.1 says the expansion excludes them, so counting them as "blocked" would report a problem
 *     where there is only a correctly shrinking audience. The counts are still surfaced.
 *  4. **resolve the sender** from `contacts.current_channel_id`, with no fallback whatsoever (§6.3).
 *     A contact whose channel is missing or not CONNECTED becomes a BLOCKED row with
 *     `SENDER_UNAVAILABLE` — persisted, so the answer survives the operator closing the screen.
 *  5. **assign variants**, manual mapping first (§9.1).
 *  6. **render** every body now and store the result (§4: `rendered_body` is the audit evidence).
 *  7. **schedule**, respecting every ceiling at once (§9.2).
 *
 * `dryRun` decides only whether step 8 (persist) happens. Preview and plan come out of the same
 * computation, which is what makes the preview trustworthy.
 */
@Injectable()
export class PlanDistributionUseCase implements UseCase<
  PlanDistributionCommand,
  DistributionPreviewDto
> {
  private readonly logger = new Logger(PlanDistributionUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(DAILY_SEND_USAGE) private readonly accountUsage: DailySendUsagePort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CHANNEL_DAILY_COUNTER_REPOSITORY)
    private readonly counters: ChannelDailyCounterRepositoryPort,
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly config: DistributionConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: PlanDistributionCommand): Promise<DistributionPreviewDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }
    if (!content.isDispatchable) {
      throw new ContentNotDispatchableException(content.status);
    }
    // Before anything is scheduled: what was approved has to fit in one message per contact. Finding
    // this out now costs an edit; finding it out at send time costs a base that received something
    // else (see ContentNotSingleMessageException).
    const attachmentProblems = findAttachmentProblems(content);
    if (attachmentProblems.length > 0) {
      throw new ContentNotSingleMessageException(attachmentProblems);
    }

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }
    if (!account.canDispatch) {
      throw new AccountSuspendedException(account.suspensionReason ?? undefined);
    }

    const window = DistributionWindow.create(command.windowStart, command.windowEnd);
    const targetFilter = TargetFilter.create({
      tags: command.tags,
      variantMappings: command.variantMappings,
    });
    const timeZone = account.timezone || this.config.defaultTimeZone;

    // ---- audience -----------------------------------------------------------------------------
    const matched = await this.contacts.list({
      tags: targetFilter.isWholeBase ? undefined : targetFilter.tags,
      page: 1,
      limit: MAX_AUDIENCE,
    });

    const sendable: Contact[] = [];
    let excludedOptedOut = 0;
    let excludedInactive = 0;
    for (const contact of matched.data) {
      if (contact.hasOptedOut) {
        excludedOptedOut += 1;
        continue;
      }
      if (!contact.active) {
        excludedInactive += 1;
        continue;
      }
      sendable.push(contact);
    }

    if (sendable.length === 0) {
      // "0 contatos encontrados" é verdade e não ajuda: o operador não sabe se a base está vazia ou
      // se a TAG é que não existe. São problemas opostos — um se resolve importando, o outro tirando
      // uma palavra do campo. Quando há filtro de tag, a mensagem conta quantos contatos a base tem.
      if (!targetFilter.isWholeBase && matched.data.length === 0) {
        const whole = await this.contacts.list({ page: 1, limit: 1 });
        throw new EmptyAudienceException(
          whole.meta.total > 0
            ? `nenhum contato com a(s) tag(s) ${targetFilter.tags.join(', ')}. ` +
                `A base tem ${whole.meta.total} contato(s) — deixe as tags em branco para usar a base inteira.`
            : 'a base ainda não tem contatos. Importe uma lista na tela de Contatos.',
        );
      }

      throw new EmptyAudienceException(
        `${matched.data.length} contato(s) encontrado(s), ${excludedOptedOut} com opt-out e ` +
          `${excludedInactive} inativo(s).`,
      );
    }

    // ---- sender resolution: current_channel_id, no fallback (§6.3) ----------------------------
    const allChannels = await this.channels.listByAccount();
    const channelsById = new Map(allChannels.map((channel) => [channel.id.value, channel]));

    const routable: Contact[] = [];
    const blockedContacts: { contact: Contact; reason: BlockedReason; detail: string }[] = [];
    for (const contact of sendable) {
      const channel = channelsById.get(contact.currentChannelId);
      if (!channel) {
        blockedContacts.push({
          contact,
          reason: BlockedReason.SENDER_UNAVAILABLE,
          detail: 'O remetente deste contato não existe mais.',
        });
        continue;
      }
      if (!channel.canSend) {
        blockedContacts.push({
          contact,
          reason: BlockedReason.SENDER_UNAVAILABLE,
          // Naming the channel and its state is the difference between a number and something the
          // operator can act on (§9.3).
          detail: `O remetente "${channel.label}" está ${channel.status} e não pode enviar.`,
        });
        continue;
      }
      routable.push(contact);
    }

    // ---- variants and rendering ---------------------------------------------------------------
    const bodies = content.sendableBodies;
    const assignments = assignVariants({
      contacts: routable.map((contact) => ({
        contactId: contact.id.value,
        tags: contact.tags,
      })),
      bodies,
      manualMappings: targetFilter.variantMappings,
    });
    const assignmentByContact = new Map(
      assignments.map((assignment) => [assignment.contactId, assignment]),
    );

    const rendered = new Map<string, { body: string; usedFallback: boolean }>();
    let fallbackCount = 0;
    for (const contact of routable) {
      const assignment = assignmentByContact.get(contact.id.value) as VariantAssignment;
      const result = renderMergeFields(assignment.body, { firstName: contact.firstName });
      rendered.set(contact.id.value, { body: result.body, usedFallback: result.usedFallback });
      if (result.usedFallback) {
        fallbackCount += 1;
      }
    }

    // ---- schedule ------------------------------------------------------------------------------
    const now = new Date();
    const today = localDateKey(now, timeZone);
    const usedByChannel = new Map<string, number>();
    const contactsByChannel = new Map<string, string[]>();
    for (const contact of routable) {
      const list = contactsByChannel.get(contact.currentChannelId) ?? [];
      list.push(contact.id.value);
      contactsByChannel.set(contact.currentChannelId, list);
    }

    const channelPlans: ChannelPlanInput[] = [];
    for (const [channelId, contactIds] of contactsByChannel) {
      const channel = channelsById.get(channelId) as Channel;
      const counter = await this.counters.findForChannelAndDate(channelId, today);
      // Only campaign sends count against the campaign allowance: replies have their own band (§10.4).
      usedByChannel.set(channelId, counter.campaignSends);
      channelPlans.push({
        channelId,
        contactIds,
        dailyQuota: channel.quota.current,
        campaignSendsToday: counter.campaignSends,
      });
    }

    const accountSentToday = await this.accountUsage.totalSentToday(account.id.value, timeZone);

    const plan = buildSchedule({
      now,
      windowStart: window.start,
      windowEnd: window.end,
      channels: channelPlans,
      rules: {
        timeZone,
        quietHoursStart: this.config.quietHoursStart,
        quietHoursEnd: this.config.quietHoursEnd,
        minIntervalSeconds: this.config.minIntervalSeconds,
        maxIntervalSeconds: this.config.maxIntervalSeconds,
        maxPerHourPerChannel: this.config.maxPerHourPerChannel,
        replyReserveRatio: this.config.replyReserveRatio,
        accountDailyCeiling: account.dailySendCeiling,
        accountSendsToday: accountSentToday,
      },
      random: Math.random,
    });

    // ---- persist (unless dry run) --------------------------------------------------------------
    const contactById = new Map(routable.map((contact) => [contact.id.value, contact]));
    let distributionId: string | null = null;
    let status = null as DistributionPreviewDto['status'];

    if (!command.dryRun) {
      const distribution = Distribution.create({
        accountId: command.accountId,
        contentId: content.id.value,
        window,
        targetFilter,
        config: {
          // Snapshot of the rules the plan was built with. Without this, a later change to the envs
          // would make the stored `scheduled_at` values unexplainable.
          timeZone,
          quietHoursStart: this.config.quietHoursStart,
          quietHoursEnd: this.config.quietHoursEnd,
          minIntervalSeconds: this.config.minIntervalSeconds,
          maxIntervalSeconds: this.config.maxIntervalSeconds,
          maxPerHourPerChannel: this.config.maxPerHourPerChannel,
          replyReservePercent: Math.round(this.config.replyReserveRatio * 100),
          accountDailyCeiling: account.dailySendCeiling,
          contentHash: content.contentHash,
        },
        createdBy: command.performedBy,
      });

      const rows: Dispatch[] = plan.sends.map((send) => {
        const assignment = assignmentByContact.get(send.contactId) as VariantAssignment;
        const body = rendered.get(send.contactId);
        return Dispatch.schedule({
          accountId: command.accountId,
          distributionId: distribution.id,
          contactId: send.contactId,
          channelId: send.channelId,
          variantId: assignment.variantId,
          renderedBody: body?.body ?? assignment.body,
          scheduledAt: send.scheduledAt,
        });
      });

      // Blocked rows are persisted too: the preview's blocked list has to survive the screen closing,
      // and "why did these 300 people never receive it?" must be answerable in a month.
      for (const blocked of blockedContacts) {
        const assignment = assignmentByContact.get(blocked.contact.id.value);
        rows.push(
          Dispatch.blocked({
            accountId: command.accountId,
            distributionId: distribution.id,
            contactId: blocked.contact.id.value,
            channelId: blocked.contact.currentChannelId,
            variantId: assignment?.variantId ?? null,
            renderedBody:
              rendered.get(blocked.contact.id.value)?.body ??
              renderMergeFields(bodies[0].body, { firstName: blocked.contact.firstName }).body,
            reason: blocked.reason,
          }),
        );
      }

      await this.unitOfWork.execute(async () => {
        await this.distributions.save(distribution);
        await this.dispatches.saveMany(rows);
      });

      distributionId = distribution.id;
      status = distribution.status;

      await this.audit.execute({
        accountId: command.accountId,
        actorType: AuditActorType.USER,
        actorId: command.performedBy,
        action: AuditAction.DISTRIBUTION_PLANNED,
        entityType: 'distribution',
        entityId: distribution.id,
        ip: command.ip,
        payload: {
          contentId: content.id.value,
          // The hash pins WHICH version this plan was built from — the same evidence the approval
          // trail carries (§8 item 4).
          contentHash: content.contentHash,
          classification: content.classification,
          tags: targetFilter.tags,
          scheduled: plan.sends.length,
          blocked: blockedContacts.length,
          overflow: plan.overflow.reduce((sum, entry) => sum + entry.contactIds.length, 0),
          estimatedDays: plan.estimatedDays,
          windowStart: window.start.toISOString(),
          windowEnd: window.end.toISOString(),
        },
      });

      this.logger.log('Distribuição planejada', {
        distributionId: distribution.id,
        scheduled: plan.sends.length,
        blocked: blockedContacts.length,
      });
    }

    // ---- preview --------------------------------------------------------------------------------
    const overflowCount = plan.overflow.reduce((sum, entry) => sum + entry.contactIds.length, 0);
    const scheduledTimes = plan.sends.map((send) => send.scheduledAt.getTime());

    const dto = new DistributionPreviewDto();
    dto.distributionId = distributionId;
    dto.contentId = content.id.value;
    dto.contentTitle = content.title;
    dto.contentHash = content.contentHash;
    dto.classification = content.classification;
    dto.status = status;
    dto.windowStart = window.start;
    dto.windowEnd = window.end;
    dto.timeZone = timeZone;
    dto.audienceMatched = matched.data.length;
    dto.excludedOptedOut = excludedOptedOut;
    dto.excludedInactive = excludedInactive;
    dto.scheduledCount = plan.sends.length;
    dto.overflowCount = overflowCount;
    dto.blockedCount = blockedContacts.length;
    dto.estimatedDays = plan.estimatedDays;
    dto.firstSendAt = scheduledTimes.length > 0 ? new Date(Math.min(...scheduledTimes)) : null;
    dto.lastSendAt = scheduledTimes.length > 0 ? new Date(Math.max(...scheduledTimes)) : null;
    dto.perChannel = plan.perChannel.map((entry) => {
      const channel = channelsById.get(entry.channelId);
      const quota = channel?.quota.current ?? 0;
      return {
        channelId: entry.channelId,
        channelLabel: channel?.label ?? 'Canal removido',
        scheduled: entry.scheduled,
        overflow: entry.overflow,
        firstDayLoad: entry.firstDayLoad,
        dailyQuota: quota,
        campaignAllowance: Math.floor(quota * (1 - this.config.replyReserveRatio)),
        alreadySentToday: usedByChannel.get(entry.channelId) ?? 0,
      };
    });
    dto.perVariant = summariseAssignments(assignments);
    dto.perDay = plan.load;
    dto.blocked = blockedContacts.map((blocked) => {
      const item = new BlockedItemDto();
      item.contactId = blocked.contact.id.value;
      item.phoneMasked = blocked.contact.phone.masked;
      item.contactName = blocked.contact.name;
      item.reason = blocked.reason;
      item.detail = blocked.detail;
      return item;
    });
    dto.fallbackCount = fallbackCount;
    dto.attachments = content.sendableBodies.flatMap((sendable) =>
      content.mediaFor(sendable.variantId).map((asset) => ({
        label: sendable.label,
        kind: asset.kind as string,
        fileName: asset.originalName,
      })),
    );
    dto.samples = this.buildSamples(routable, assignmentByContact, rendered, contactById);
    // Adendo 02 §3: nomear O TETO que amarrou, com a ação que de fato destrava aquele caso. O texto
    // genérico anterior chegava a sugerir "estender a janela" para uma cota esgotada e "adicionar
    // canais" para um teto de conta que torna chip novo inútil.
    const explanation = explainBindingConstraint(plan.binding, {
      overflowCount,
      channelCount: channelPlans.length,
      sentToday: channelPlans.reduce((total, channel) => total + channel.campaignSendsToday, 0),
      allowanceToday: channelPlans.reduce(
        (total, channel) =>
          total + Math.floor(channel.dailyQuota * (1 - this.config.replyReserveRatio)),
        0,
      ),
      accountDailyCeiling: account.dailySendCeiling,
    });

    dto.bindingConstraint = plan.binding.constraint;
    dto.bindingCapacityFirstDay = plan.binding.capacityFirstDay;
    dto.bindingWindowExhausted = plan.binding.windowExhausted;
    dto.bindingReason = explanation.reason;
    dto.overflowOptions = overflowCount > 0 ? explanation.options : [];

    return dto;
  }

  /**
   * Three real renderings, and one of them shows the fallback whenever the audience contains a
   * contact without `first_name` (§7.4: "um sem `first_name` para mostrar o fallback em ação").
   *
   * Picking a fallback case on purpose rather than hoping one lands in the first three: the fallback
   * is the case operators forget, and a preview that never shows it is the reason they forget.
   */
  private buildSamples(
    routable: readonly Contact[],
    assignments: Map<string, VariantAssignment>,
    rendered: Map<string, { body: string; usedFallback: boolean }>,
    contactById: Map<string, Contact>,
  ): RenderedSampleDto[] {
    const withFallback = routable.filter(
      (contact) => rendered.get(contact.id.value)?.usedFallback === true,
    );
    const withName = routable.filter(
      (contact) => rendered.get(contact.id.value)?.usedFallback === false,
    );

    const chosen: Contact[] = [];
    if (withFallback.length > 0) {
      chosen.push(withFallback[0]);
    }
    for (const contact of withName) {
      if (chosen.length >= SAMPLE_SIZE) {
        break;
      }
      chosen.push(contact);
    }
    for (const contact of withFallback.slice(1)) {
      if (chosen.length >= SAMPLE_SIZE) {
        break;
      }
      chosen.push(contact);
    }

    return chosen.map((contact) => {
      const result = rendered.get(contact.id.value);
      const sample = new RenderedSampleDto();
      sample.contactName = contactById.get(contact.id.value)?.name ?? null;
      sample.label = assignments.get(contact.id.value)?.label ?? 'Base';
      sample.renderedBody = result?.body ?? '';
      sample.usedFallback = result?.usedFallback ?? false;
      return sample;
    });
  }
}
