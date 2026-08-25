import { DomainException } from '@gitspread/domain-primitives';

/** Refused state change. The message names both ends so the log says what was attempted. */
export class InvalidDistributionTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(`Distribuição em ${from} não pode ir para ${to}.`);
  }
}
