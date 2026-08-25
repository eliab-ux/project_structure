import { DomainException } from '@gitspread/domain-primitives';
import { AttachmentProblem } from '../services/attachment-policy';

/**
 * Raised when a content cannot go out as ONE WhatsApp message per contact.
 *
 * It is thrown at planning time on purpose: refusing to plan is recoverable — the operator edits the
 * content and plans again — while discovering it at send time means part of the base already received
 * something other than what was approved.
 */
export class ContentNotSingleMessageException extends DomainException {
  constructor(problems: AttachmentProblem[]) {
    super(
      'Este conteúdo não cabe em uma única mensagem: ' +
        problems.map((problem) => `${problem.label} — ${problem.reason}`).join(' | '),
    );
  }
}
