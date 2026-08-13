import { DomainException, ValueObject } from '@veertex/domain-primitives';
import {
  BRAZILIAN_STATES,
  BrazilianState,
} from '../../../../shared/domain/value-objects/address.vo';

export class InvalidStateRegistrationException extends DomainException {}

/**
 * An "inscrição estadual de substituto tributário" — one per state where the company is registered
 * as a tax substitute (01_Veertex_Core §3.2 asks for the list explicitly).
 *
 * The registration NUMBER is not validated beyond shape: each state has its own algorithm and its
 * own exceptions, and a wrong rejection here would block a company from invoicing at all. Digits
 * only, so the value matches whatever the state's portal returns regardless of punctuation.
 */
export class StateRegistration extends ValueObject<{
  state: BrazilianState;
  registration: string;
}> {
  private constructor(props: { state: BrazilianState; registration: string }) {
    super(props);
  }

  static create(state: string, registration: string): StateRegistration {
    const uf = (state ?? '').trim().toUpperCase();
    const digits = (registration ?? '').replace(/\D/g, '');

    if (!BRAZILIAN_STATES.includes(uf as BrazilianState)) {
      throw new InvalidStateRegistrationException('UF inválida na inscrição de substituto.');
    }
    if (digits.length < 2 || digits.length > 20) {
      throw new InvalidStateRegistrationException(
        'Inscrição estadual de substituto tributário inválida.',
      );
    }

    return new StateRegistration({ state: uf as BrazilianState, registration: digits });
  }

  get state(): BrazilianState {
    return this.props.state;
  }

  get registration(): string {
    return this.props.registration;
  }
}
