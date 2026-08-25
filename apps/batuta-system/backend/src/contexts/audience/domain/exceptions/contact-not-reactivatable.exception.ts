import { DomainException } from '@gitspread/domain-primitives';

/**
 * Raised when putting a contact back into routing would undo something that must not be undone.
 *
 * There is exactly one such case: an **opt-out**. Deactivation is reversible because it records an
 * operator's decision ("stop sending to this one"), and decisions get revisited. An opt-out records the
 * CONTACT's decision, and §6.5 makes it permanent — the system has no authority to reverse it.
 *
 * The guard lives in the entity rather than in the use case so that no future caller can set
 * `active = true` on someone who asked to be left alone, whatever path it arrives by.
 */
export class ContactNotReactivatableException extends DomainException {
  constructor(reason: string) {
    super(reason);
  }
}
