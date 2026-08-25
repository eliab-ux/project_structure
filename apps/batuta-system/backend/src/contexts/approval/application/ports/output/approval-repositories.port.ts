import { ApprovalSettings } from '../../../domain/entities/approval-settings.entity';
import { Approver } from '../../../domain/entities/approver.entity';
import { ApprovalRequest } from '../../../domain/entities/approval-request.entity';

export const APPROVAL_SETTINGS_REPOSITORY = Symbol('APPROVAL_SETTINGS_REPOSITORY');
export const APPROVER_REPOSITORY = Symbol('APPROVER_REPOSITORY');
export const APPROVAL_REQUEST_REPOSITORY = Symbol('APPROVAL_REQUEST_REPOSITORY');
export const CONTENT_AUTHOR_PROVIDER = Symbol('CONTENT_AUTHOR_PROVIDER');

export interface ApprovalSettingsRepositoryPort {
  /** Null when the account never configured it — the caller substitutes the documented defaults. */
  find(): Promise<ApprovalSettings | null>;
  save(settings: ApprovalSettings): Promise<ApprovalSettings>;
}

export interface ApproverRepositoryPort {
  findById(id: string): Promise<Approver | null>;
  findByEmail(email: string): Promise<Approver | null>;
  listAll(): Promise<Approver[]>;
  listActive(): Promise<Approver[]>;
  save(approver: Approver): Promise<Approver>;
}

export interface ApprovalRequestRepositoryPort {
  findById(id: string): Promise<ApprovalRequest | null>;
  listForContent(contentId: string): Promise<ApprovalRequest[]>;
  saveMany(requests: readonly ApprovalRequest[]): Promise<void>;
  save(request: ApprovalRequest): Promise<ApprovalRequest>;
  /** Marks every pending request of a content as INVALIDATED (§8.5). */
  invalidatePendingForContent(contentId: string): Promise<number>;

  /**
   * Looks a magic-link token up by its hash.
   *
   * Unscoped BY NECESSITY: the link is opened by an approver who has no account, no session and no JWT
   * (§8 item 2 and item 4). What protects it is the token — 256 bits, stored only as a SHA-256, single
   * use, short TTL — plus the rate limit on the route. The returned request carries its `accountId`,
   * and every step after this one is scoped by it.
   */
  findByTokenHashUnscoped(tokenHash: string): Promise<ApprovalRequest | null>;
}

/**
 * Resolves the e-mail of the account user who wrote a content.
 *
 * Exists for exactly one check: **aprovador ≠ autor** (§8.5). §14 item 11 allows an approver to be an
 * account user, so the comparison has to be by identity, and the only identity `approvers` has is an
 * e-mail — the table deliberately holds no `user_id`.
 *
 * A port rather than a direct dependency on the user repository: the approval context should not reach
 * into the user context's persistence.
 */
export interface ContentAuthorProviderPort {
  /** Null when the author's user row is gone — the check then simply cannot exclude anyone. */
  emailOf(userId: string): Promise<string | null>;
}
