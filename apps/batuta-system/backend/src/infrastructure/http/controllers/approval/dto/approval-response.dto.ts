import {
  ApprovalDecisionResultDto,
  ApprovalPageDto,
  ApprovalProgressDto,
  ApprovalRequestDto,
  ApprovalSettingsDto,
  ApproverDto,
  SubmissionResultDto,
} from '../../../../../contexts/approval/application/dto/approval.dto';

export class ApprovalSettingsResponseDto {
  requiredForInstitutional!: number;
  requiredForElectoral!: number;
  notifyChannel!: string;

  static from(dto: ApprovalSettingsDto): ApprovalSettingsResponseDto {
    const response = new ApprovalSettingsResponseDto();
    response.requiredForInstitutional = dto.requiredForInstitutional;
    response.requiredForElectoral = dto.requiredForElectoral;
    response.notifyChannel = dto.notifyChannel;
    return response;
  }
}

export class ApproverResponseDto {
  id!: string;
  name!: string;
  email!: string | null;
  /** Masked — a list of approvers is not a place to hand out phone numbers. */
  phoneMasked!: string | null;
  active!: boolean;
  createdAt!: Date;

  static from(dto: ApproverDto): ApproverResponseDto {
    const response = new ApproverResponseDto();
    response.id = dto.id;
    response.name = dto.name;
    response.email = dto.email;
    response.phoneMasked = dto.phoneMasked;
    response.active = dto.active;
    response.createdAt = dto.createdAt;
    return response;
  }
}

export class ApprovalRequestResponseDto {
  id!: string;
  approverId!: string;
  approverName!: string;
  status!: string;
  contentHash!: string;
  expiresAt!: Date;
  decidedAt!: Date | null;
  comment!: string | null;

  static from(dto: ApprovalRequestDto): ApprovalRequestResponseDto {
    const response = new ApprovalRequestResponseDto();
    response.id = dto.id;
    response.approverId = dto.approverId;
    response.approverName = dto.approverName;
    response.status = dto.status;
    response.contentHash = dto.contentHash;
    response.expiresAt = dto.expiresAt;
    response.decidedAt = dto.decidedAt;
    response.comment = dto.comment;
    // `decidedFrom` (the IP) is NOT mapped: it belongs in the audit trail, not on a tracking screen.
    // `tokenHash` never leaves the repository at all.
    return response;
  }
}

export class SubmissionResponseDto {
  contentId!: string;
  contentHash!: string;
  status!: string;
  requiredApprovals!: number;
  requestsCreated!: number;
  notifiedApprovers!: string[];
  /** Non-empty when a link failed to go out. Surfaced so the operator can act, never swallowed. */
  notificationFailures!: string[];

  static from(dto: SubmissionResultDto): SubmissionResponseDto {
    const response = new SubmissionResponseDto();
    response.contentId = dto.contentId;
    response.contentHash = dto.contentHash;
    response.status = dto.status;
    response.requiredApprovals = dto.requiredApprovals;
    response.requestsCreated = dto.requestsCreated;
    response.notifiedApprovers = dto.notifiedApprovers;
    response.notificationFailures = dto.notificationFailures;
    return response;
  }
}

export class ApprovalProgressResponseDto {
  contentId!: string;
  contentStatus!: string;
  contentHash!: string;
  requiredApprovals!: number;
  approvedCount!: number;
  pendingCount!: number;
  rejectedCount!: number;
  requests!: ApprovalRequestResponseDto[];

  static from(dto: ApprovalProgressDto): ApprovalProgressResponseDto {
    const response = new ApprovalProgressResponseDto();
    response.contentId = dto.contentId;
    response.contentStatus = dto.contentStatus;
    response.contentHash = dto.contentHash;
    response.requiredApprovals = dto.requiredApprovals;
    response.approvedCount = dto.approvedCount;
    response.pendingCount = dto.pendingCount;
    response.rejectedCount = dto.rejectedCount;
    response.requests = dto.requests.map((request) => ApprovalRequestResponseDto.from(request));
    return response;
  }
}

/**
 * The public page payload.
 *
 * Everything here is about ONE message. There is no account name, no audience, no other content, no
 * user — whoever holds this link is not a user of the system and must see exactly what they are being
 * asked to decide on, and nothing else that could be used to map the campaign.
 */
export class ApprovalPageResponseDto {
  approverName!: string;
  contentTitle!: string;
  classification!: string;
  contentHash!: string;
  bodyBase!: string;
  sourceUrl!: string | null;
  includeSourceUrl!: boolean;
  variants!: { label: string; body: string }[];
  media!: { id: string; kind: string; originalName: string; downloadUrl: string | null }[];
  renderedSamples!: { label: string; renderedBody: string; usedFallback: boolean }[];
  expiresAt!: Date;
  requiredApprovals!: number;
  approvalsSoFar!: number;

  static from(dto: ApprovalPageDto): ApprovalPageResponseDto {
    const response = new ApprovalPageResponseDto();
    response.approverName = dto.approverName;
    response.contentTitle = dto.contentTitle;
    response.classification = dto.classification;
    response.contentHash = dto.contentHash;
    response.bodyBase = dto.bodyBase;
    response.sourceUrl = dto.sourceUrl;
    response.includeSourceUrl = dto.includeSourceUrl;
    response.variants = dto.variants;
    response.media = dto.media;
    response.renderedSamples = dto.renderedSamples;
    response.expiresAt = dto.expiresAt;
    response.requiredApprovals = dto.requiredApprovals;
    response.approvalsSoFar = dto.approvalsSoFar;
    return response;
  }
}

export class ApprovalDecisionResponseDto {
  decision!: string;
  contentTitle!: string;
  contentApproved!: boolean;
  contentRejected!: boolean;
  approvalsSoFar!: number;
  requiredApprovals!: number;

  static from(dto: ApprovalDecisionResultDto): ApprovalDecisionResponseDto {
    const response = new ApprovalDecisionResponseDto();
    response.decision = dto.decision;
    response.contentTitle = dto.contentTitle;
    response.contentApproved = dto.contentApproved;
    response.contentRejected = dto.contentRejected;
    response.approvalsSoFar = dto.approvalsSoFar;
    response.requiredApprovals = dto.requiredApprovals;
    return response;
  }
}
