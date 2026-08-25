import { DomainException } from '@gitspread/domain-primitives';

/**
 * The magic link is unusable: unknown, already used, expired, or the content changed underneath it.
 *
 * One exception for all four cases, and the reason is deliberate: the caller of the public route is
 * unauthenticated, so distinguishing "this token never existed" from "this token was already used"
 * would confirm to a stranger which tokens exist. The `reason` is only ever passed for the cases the
 * approver themself needs to understand — an expired link, or a content that was edited.
 */
export class InvalidApprovalTokenException extends DomainException {
  constructor(reason?: string) {
    super(
      reason
        ? `Este link de aprovação não é mais válido: ${reason}`
        : 'Este link de aprovação não é mais válido. Peça um novo ao responsável.',
    );
  }
}
