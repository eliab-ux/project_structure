export interface CreateCompanyAddressInput {
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  ibgeCityCode?: string | null;
}

export interface CreateCompanyStateRegistrationInput {
  state: string;
  registration: string;
}

/**
 * Note what is NOT here: `accountId`. The tenant comes from the JWT via the controller, never from
 * the payload — see the `AuthTokenPayload` docblock.
 */
export class CreateCompanyCommand {
  constructor(
    public readonly accountId: string,
    public readonly legalName: string,
    public readonly document: string,
    public readonly taxRegime: string,
    public readonly address: CreateCompanyAddressInput,
    public readonly stateRegistrationExempt: boolean,
    public readonly tradeName?: string | null,
    public readonly stateRegistration?: string | null,
    public readonly municipalRegistration?: string | null,
    public readonly suframa?: string | null,
    public readonly cnae?: string | null,
    public readonly contactEmail?: string | null,
    public readonly billingEmail?: string | null,
    public readonly phone?: string | null,
    public readonly stateRegistrations?: CreateCompanyStateRegistrationInput[],
  ) {}
}
