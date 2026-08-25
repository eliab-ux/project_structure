import { DomainException } from '@gitspread/domain-primitives';

/**
 * The filter matched nobody sendable.
 *
 * Refused rather than accepted as an empty distribution: a plan with zero recipients is always a
 * mistake in the filter, and creating it would report "distribuição criada" for something that will
 * never send anything.
 */
export class EmptyAudienceException extends DomainException {
  constructor(detail: string) {
    super(`Nenhum contato enviável neste público: ${detail}`);
  }
}
