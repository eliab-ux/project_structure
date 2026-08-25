import { DomainException } from '@gitspread/domain-primitives';

/**
 * A merge field without a fallback, or an unknown one (7.4).
 *
 * Carries EVERY problem found, not just the first: an author fixing a body one error per save is an
 * author who gives up and writes the name by hand.
 */
export class InvalidMergeFieldException extends DomainException {
  constructor(public readonly issues: readonly string[]) {
    super(issues.join(' '));
  }
}
