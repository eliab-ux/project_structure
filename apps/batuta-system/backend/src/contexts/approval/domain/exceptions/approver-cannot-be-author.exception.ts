import { DomainException } from '@gitspread/domain-primitives';

/**
 * §8.5, first invariant: **Aprovador ≠ autor.** "Bloqueie na aplicação."
 *
 * §14 item 11 settles the related question: an approver MAY also be a user of the account — many
 * offices are three people — but never the author of the very content being reviewed. Self-approval
 * would make the whole trail worthless: the point of §8 is that the record is DEFENSIBLE, and
 * "I approved my own text" defends nothing.
 */
export class ApproverCannotBeAuthorException extends DomainException {
  constructor(approverName: string) {
    super(
      `${approverName} é o autor deste conteúdo e não pode aprová-lo. ` +
        'Cadastre outro aprovador ou peça a outra pessoa que escreva.',
    );
  }
}

/**
 * Raised when the account asks for two approvals but has fewer eligible approvers than that — after
 * removing the author.
 */
export class NotEnoughApproversException extends DomainException {
  constructor(required: number, available: number) {
    super(
      `A conta exige ${required} aprovação(ões) para esta classificação, mas só há ${available} ` +
        'aprovador(es) elegível(is) — o autor não conta. Cadastre mais aprovadores.',
    );
  }
}
