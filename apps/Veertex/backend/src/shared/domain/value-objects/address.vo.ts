import { DomainException, ValueObject } from '@gitspread/domain-primitives';

export class InvalidAddressException extends DomainException {}

/** The 26 states plus the Federal District. Used to validate `state` and, later, ST/ICMS rules. */
export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

export interface AddressProps {
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: BrazilianState;
  /** CEP, digits only. */
  zipCode: string;
  /**
   * IBGE municipality code (7 digits).
   *
   * Nullable in the model but requested at every entry point, and here is why it exists in F1 at
   * all: NF-e requires it, and adding the column later would mean backfilling every company by
   * looking each city up — cheap now, a migration with a data-fetch step later.
   */
  ibgeCityCode: string | null;
}

/**
 * A postal address. Immutable — changing an address produces a new value, which is what makes it
 * safe to snapshot onto an order later without the order's address mutating under it.
 */
export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  static create(input: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    ibgeCityCode?: string | null;
  }): Address {
    const street = (input.street ?? '').trim();
    const number = (input.number ?? '').trim();
    const district = (input.district ?? '').trim();
    const city = (input.city ?? '').trim();
    const state = (input.state ?? '').trim().toUpperCase();
    const zipCode = (input.zipCode ?? '').replace(/\D/g, '');
    const ibgeCityCode = (input.ibgeCityCode ?? '').replace(/\D/g, '') || null;

    if (!street || !number || !district || !city) {
      throw new InvalidAddressException(
        'Endereço incompleto: logradouro, número, bairro e cidade são obrigatórios.',
      );
    }
    if (!BRAZILIAN_STATES.includes(state as BrazilianState)) {
      throw new InvalidAddressException('UF inválida.');
    }
    if (zipCode.length !== 8) {
      throw new InvalidAddressException('CEP deve ter 8 dígitos.');
    }
    if (ibgeCityCode !== null && ibgeCityCode.length !== 7) {
      throw new InvalidAddressException('Código IBGE do município deve ter 7 dígitos.');
    }

    return new Address({
      street,
      number,
      complement: (input.complement ?? '').trim() || null,
      district,
      city,
      state: state as BrazilianState,
      zipCode,
      ibgeCityCode,
    });
  }

  get street(): string {
    return this.props.street;
  }

  get number(): string {
    return this.props.number;
  }

  get complement(): string | null {
    return this.props.complement;
  }

  get district(): string {
    return this.props.district;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): BrazilianState {
    return this.props.state;
  }

  get zipCode(): string {
    return this.props.zipCode;
  }

  get ibgeCityCode(): string | null {
    return this.props.ibgeCityCode;
  }

  get formattedZipCode(): string {
    return `${this.props.zipCode.slice(0, 5)}-${this.props.zipCode.slice(5)}`;
  }
}
