import { ContentStatus } from '../../../content/domain/value-objects/content-status.vo';
import { ApprovalRequest } from '../../domain/entities/approval-request.entity';
import { ApprovalSettings } from '../../domain/entities/approval-settings.entity';
import { Approver } from '../../domain/entities/approver.entity';
import { ApprovalRequestStatus } from '../../domain/value-objects/approval-status.vo';
import { NotifyChannel } from '../../domain/value-objects/notify-channel.vo';

export class ApprovalSettingsDto {
  requiredForInstitutional!: number;
  requiredForElectoral!: number;
  notifyChannel!: NotifyChannel;

  static fromDomain(settings: ApprovalSettings): ApprovalSettingsDto {
    const dto = new ApprovalSettingsDto();
    dto.requiredForInstitutional = settings.requiredForInstitutional;
    dto.requiredForElectoral = settings.requiredForElectoral;
    dto.notifyChannel = settings.notifyChannel;
    return dto;
  }
}

export class ApproverDto {
  id!: string;
  name!: string;
  email!: string | null;
  /** Masked: an approver list is not a place to expose numbers. */
  phoneMasked!: string | null;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(approver: Approver): ApproverDto {
    const dto = new ApproverDto();
    dto.id = approver.id;
    dto.name = approver.name;
    dto.email = approver.email?.value ?? null;
    dto.phoneMasked = approver.phone?.masked ?? null;
    dto.active = approver.active;
    dto.createdAt = approver.createdAt;
    return dto;
  }
}

/** One request, as the author sees it while tracking a submission. */
export class ApprovalRequestDto {
  id!: string;
  approverId!: string;
  approverName!: string;
  status!: ApprovalRequestStatus;
  /** The version this decision refers to (§8 item 4). */
  contentHash!: string;
  expiresAt!: Date;
  decidedAt!: Date | null;
  /** Visible to the author, which is the whole point on a rejection (§8.5). */
  comment!: string | null;
  /** Kept coarse for the author's view; the full IP lives in the row and in the audit trail. */
  decidedFrom!: string | null;

  static fromDomain(request: ApprovalRequest, approverName: string): ApprovalRequestDto {
    const dto = new ApprovalRequestDto();
    dto.id = request.id;
    dto.approverId = request.approverId;
    dto.approverName = approverName;
    dto.status = request.status;
    dto.contentHash = request.contentHash;
    dto.expiresAt = request.expiresAt;
    dto.decidedAt = request.decidedAt;
    dto.comment = request.comment;
    dto.decidedFrom = request.decidedIp;
    // tokenHash is never mapped: it is the credential.
    return dto;
  }
}

export class SubmissionResultDto {
  contentId!: string;
  contentHash!: string;
  status!: ContentStatus;
  requiredApprovals!: number;
  requestsCreated!: number;
  notifiedApprovers!: string[];
  /** Non-empty when a link did not go out. Reported, never swallowed. */
  notificationFailures!: string[];
}

/** Progress of a submission, for the author's tracking screen (§8, FASE 10 screen 7). */
export class ApprovalProgressDto {
  contentId!: string;
  contentStatus!: ContentStatus;
  contentHash!: string;
  requiredApprovals!: number;
  approvedCount!: number;
  pendingCount!: number;
  rejectedCount!: number;
  requests!: ApprovalRequestDto[];
}

export class ApprovalDecisionResultDto {
  decision!: 'APPROVED' | 'REJECTED';
  contentTitle!: string;
  /** True when this decision completed the requirement and the content became APPROVED. */
  contentApproved!: boolean;
  /** True when this decision rejected the content. */
  contentRejected!: boolean;
  approvalsSoFar!: number;
  requiredApprovals!: number;
}

/**
 * What the magic-link page shows (§8 item 4): "o conteúdo exato submetido (texto, variantes, mídias,
 * amostra renderizada) e o `content_hash`".
 *
 * Note what is absent: anything about the account, the audience, or other contents. Whoever holds this
 * link is not a user of the system and must see exactly one thing — the message they are being asked to
 * approve.
 */
export class ApprovalPageDto {
  approverName!: string;
  contentTitle!: string;
  classification!: string;
  /** The exact version identifier, shown on the page so the record is unambiguous. */
  contentHash!: string;
  bodyBase!: string;
  /** Procedência: de onde veio o texto. Metadado, não faz parte do content_hash. */
  sourceUrl!: string | null;
  /**
   * True when that link is part of the message the contact receives, not just provenance.
   *
   * The approver has to be told which of the two it is: approving a link that goes out is approving
   * a destination, and approving a link that stays behind is only confirming where the text came from.
   */
  includeSourceUrl!: boolean;
  variants!: { label: string; body: string }[];
  media!: { id: string; kind: string; originalName: string; downloadUrl: string | null }[];
  /** Rendered against real contacts, including the fallback case (§7.4). */
  renderedSamples!: { label: string; renderedBody: string; usedFallback: boolean }[];
  expiresAt!: Date;
  requiredApprovals!: number;
  approvalsSoFar!: number;
}
