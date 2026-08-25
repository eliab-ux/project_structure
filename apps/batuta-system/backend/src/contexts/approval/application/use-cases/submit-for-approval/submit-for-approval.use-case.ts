import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { ContentNotFoundException } from '../../../../content/domain/exceptions/content-not-found.exception';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ApprovalRequest } from '../../../domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { Approver } from '../../../domain/entities/approver.entity';
import { includesEmail, includesWhatsApp } from '../../../domain/value-objects/notify-channel.vo';
import {
  ApproverCannotBeAuthorException,
  NotEnoughApproversException,
} from '../../../domain/exceptions/approver-cannot-be-author.exception';
import { NoActiveApproverException } from '../../../domain/exceptions/no-active-approver.exception';
import { SubmissionResultDto } from '../../dto/approval.dto';
import {
  APPROVAL_REQUEST_REPOSITORY,
  APPROVAL_SETTINGS_REPOSITORY,
  APPROVER_REPOSITORY,
  ApprovalRequestRepositoryPort,
  ApprovalSettingsRepositoryPort,
  ApproverRepositoryPort,
  CONTENT_AUTHOR_PROVIDER,
  ContentAuthorProviderPort,
} from '../../ports/output/approval-repositories.port';
import { SYSTEM_NOTIFIER, SystemNotifierPort } from '../../ports/output/system-notifier.port';
import { SubmitForApprovalCommand } from './submit-for-approval.command';

const DEFAULT_TTL_HOURS = 72;

/**
 * Sends a content for approval (§8).
 *
 * The sequence, and why:
 *  1. load the content and the account's policy — how many approvals THIS classification needs;
 *  2. pick the eligible approvers, EXCLUDING the author (§8.5, first invariant);
 *  3. refuse if there are fewer eligible approvers than the policy requires, rather than silently
 *     creating a submission that can never reach its threshold;
 *  4. issue one request per approver, each with its own single-use token bound to the current
 *     `content_hash`;
 *  5. persist content + requests in ONE transaction;
 *  6. only then notify, through the SYSTEM channel.
 *
 * Notification comes last and outside the transaction on purpose: a link that arrives for a submission
 * that then failed to commit is worse than a submission whose e-mail needs resending.
 */
@Injectable()
export class SubmitForApprovalUseCase implements UseCase<
  SubmitForApprovalCommand,
  SubmissionResultDto
> {
  private readonly logger = new Logger(SubmitForApprovalUseCase.name);

  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(APPROVAL_SETTINGS_REPOSITORY)
    private readonly settingsRepository: ApprovalSettingsRepositoryPort,
    @Inject(APPROVER_REPOSITORY) private readonly approvers: ApproverRepositoryPort,
    @Inject(APPROVAL_REQUEST_REPOSITORY)
    private readonly requests: ApprovalRequestRepositoryPort,
    @Inject(CONTENT_AUTHOR_PROVIDER) private readonly authors: ContentAuthorProviderPort,
    @Inject(SYSTEM_NOTIFIER) private readonly notifier: SystemNotifierPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    private readonly audit: RecordAuditLogUseCase,
    private readonly config: ConfigService,
  ) {}

  async execute(command: SubmitForApprovalCommand): Promise<SubmissionResultDto> {
    const content = await this.contents.findById(ContentId.from(command.contentId));
    if (!content) {
      throw new ContentNotFoundException();
    }

    const settings =
      (await this.settingsRepository.find()) ?? ApprovalSettings.createDefault(command.accountId);
    const required = settings.requiredFor(content.classification);

    const active = await this.approvers.listActive();
    if (active.length === 0) {
      throw new NoActiveApproverException();
    }

    // §8.5: aprovador ≠ autor. §14 item 11 allows an approver to also be an account user, so the
    // exclusion is by identity (e-mail), not by role.
    const authorEmail = await this.authors.emailOf(content.createdBy);
    const eligible = active.filter((approver) => !approver.isSamePersonAs(authorEmail));

    if (eligible.length === 0) {
      const self = active.find((approver) => approver.isSamePersonAs(authorEmail));
      throw new ApproverCannotBeAuthorException(self?.name ?? 'O autor');
    }
    if (eligible.length < required) {
      // Creating a submission that can never reach its threshold would look like progress and stall
      // forever.
      throw new NotEnoughApproversException(required, eligible.length);
    }

    const reachable = eligible.filter((approver) =>
      SubmitForApprovalUseCase.isReachable(approver, settings),
    );
    if (reachable.length < required) {
      throw new NotEnoughApproversException(required, reachable.length);
    }

    const ttlHours = Number(
      this.config.get<number>('APPROVAL_TOKEN_TTL_HOURS') ?? DEFAULT_TTL_HOURS,
    );

    // Everyone gets a link. The threshold decides when the content flips, not who is asked.
    const issued = reachable.map((approver) => ({
      approver,
      ...ApprovalRequest.issue({
        accountId: command.accountId,
        contentId: content.id.value,
        contentHash: content.contentHash,
        approverId: approver.id,
        ttlHours,
      }),
    }));

    await this.unitOfWork.execute(async () => {
      content.submitForApproval();
      await this.contents.save(content);
      await this.requests.saveMany(issued.map((entry) => entry.request));
    });

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3003'
    ).replace(/\/$/, '');

    const notifications = await Promise.all(
      issued.map(async (entry) => {
        const link = `${frontendUrl}/aprovacao/${entry.token.plaintext}`;
        const result = await this.notifier.notify({
          recipientName: entry.approver.name,
          email: includesEmail(settings.notifyChannel)
            ? (entry.approver.email?.value ?? null)
            : null,
          phoneE164: includesWhatsApp(settings.notifyChannel)
            ? (entry.approver.phone?.value ?? null)
            : null,
          subject: `Aprovação pendente: ${content.title}`,
          body: SubmitForApprovalUseCase.buildMessage({
            approverName: entry.approver.name,
            title: content.title,
            classification: content.classification,
            link,
            ttlHours,
          }),
        });
        return { approver: entry.approver, result };
      }),
    );

    const failures = notifications.flatMap((entry) =>
      entry.result.failures.map((failure) => `${entry.approver.name}: ${failure}`),
    );

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTENT_SUBMITTED_FOR_APPROVAL,
      entityType: 'content',
      entityId: content.id.value,
      ip: command.ip,
      // The hash is the point: this is the version that was sent out for approval. No token, ever —
      // the audit sanitizer would redact it anyway.
      payload: {
        contentHash: content.contentHash,
        classification: content.classification,
        requiredApprovals: required,
        requestsCreated: issued.length,
        notifyChannel: settings.notifyChannel,
        notificationFailures: failures.length,
      },
    });

    if (failures.length > 0) {
      // Reported, never swallowed: the operator has to know a link did not arrive.
      this.logger.warn('Conteúdo submetido, mas alguma notificação falhou', {
        contentId: content.id.value,
        failures: failures.length,
      });
    }

    this.logger.log('Conteúdo enviado para aprovação', {
      contentId: content.id.value,
      requests: issued.length,
      required,
    });

    const dto = new SubmissionResultDto();
    dto.contentId = content.id.value;
    dto.contentHash = content.contentHash;
    dto.status = content.status;
    dto.requiredApprovals = required;
    dto.requestsCreated = issued.length;
    dto.notifiedApprovers = notifications
      .filter((entry) => entry.result.emailSent || entry.result.whatsAppSent)
      .map((entry) => entry.approver.name);
    dto.notificationFailures = failures;
    return dto;
  }

  /** An approver the chosen channel cannot actually reach is not an approver for this submission. */
  private static isReachable(approver: Approver, settings: ApprovalSettings): boolean {
    const byEmail = includesEmail(settings.notifyChannel) && approver.canReceiveEmail;
    const byWhatsApp = includesWhatsApp(settings.notifyChannel) && approver.canReceiveWhatsApp;
    return byEmail || byWhatsApp;
  }

  /**
   * The message carries the LINK and nothing else (§8 item 4).
   *
   * Deliberately not the content text: the decision must happen on the page that shows the exact
   * version and records IP, timestamp and hash. A WhatsApp message with the text invites a "aprovado 👍"
   * reply, which the spec calls "a prova mais fraca possível".
   */
  private static buildMessage(params: {
    approverName: string;
    title: string;
    classification: string;
    link: string;
    ttlHours: number;
  }): string {
    return (
      `Olá, ${params.approverName}.\n\n` +
      `Há um conteúdo aguardando sua aprovação:\n"${params.title}" (${params.classification}).\n\n` +
      `Abra o link para ver o texto exato e decidir:\n${params.link}\n\n` +
      `O link vale por ${params.ttlHours} horas e só pode ser usado uma vez. ` +
      'Responder esta mensagem não registra a aprovação — é preciso abrir o link.'
    );
  }
}
