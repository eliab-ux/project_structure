import { DomainException } from '@gitspread/domain-primitives';

/**
 * The reply cannot go out.
 *
 * Its own exception because every cause is "the channel of THIS conversation is unusable" — and the
 * answer is never "send through another chip". §10.4: a reply leaves through the number the contact
 * knows, or it does not leave.
 */
export class ReplyNotPossibleException extends DomainException {
  constructor(detail: string) {
    super(`Não é possível responder agora: ${detail}`);
  }
}
