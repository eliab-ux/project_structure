import { ValueObject } from '@gitspread/domain-primitives';

interface ShippingAddressProps {
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  complement?: string | null;
}

export class ShippingAddress extends ValueObject<ShippingAddressProps> {
  private constructor(props: ShippingAddressProps) {
    super(props);
  }

  static create(props: ShippingAddressProps): ShippingAddress {
    ShippingAddress.validate(props);
    return new ShippingAddress({ ...props, complement: props.complement ?? null });
  }

  private static validate(props: ShippingAddressProps): void {
    if (
      !props.street.trim() ||
      !props.city.trim() ||
      !props.state.trim() ||
      !props.zipCode.trim()
    ) {
      throw new Error('Shipping address must include street, city, state and zip code.');
    }
  }

  get street(): string {
    return this.props.street;
  }

  get number(): string {
    return this.props.number;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  get zipCode(): string {
    return this.props.zipCode;
  }

  get country(): string {
    return this.props.country;
  }

  get complement(): string | null | undefined {
    return this.props.complement ?? null;
  }
}
