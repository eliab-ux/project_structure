import { DomainException } from '@gitspread/domain-primitives';

/**
 * Raised when removing a contact would destroy something that must survive them.
 *
 * Two things outrank the wish to clean up a list, and both are stated in the message so the operator
 * knows what to do instead rather than trying again:
 *
 *  - **A send that happened.** `dispatches` records what text went to which number and when (§4, §11).
 *    For electoral content that record is the defence if the message is ever questioned. Deleting the
 *    contact would cascade nothing — the FK simply refuses — and it should: the campaign report cannot
 *    be made to disagree with what was sent.
 *  - **An opt-out.** It is irreversible by design (§6.5), and deleting the row is the one way to make
 *    it reversible: the next import of the same spreadsheet brings the number back with a clean
 *    slate, and someone who asked to be left alone is messaged again. The contact is already
 *    permanently suppressed; deleting adds nothing except that risk.
 */
export class ContactNotDeletableException extends DomainException {
  constructor(reason: string) {
    super(reason);
  }
}
