import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';

/** As 27 UFs. Um estado escrito errado inutiliza a linha do cliente no relatório do governo. */
const UF = [
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

interface AddressProps {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
}

/**
 * Endereço do cliente (spec §4.4).
 *
 * Só `city` e `state` são obrigatórios, e não por descuido: a **cidade é coluna do relatório
 * mensal do governo**. O resto do endereço serve à operação e pode ser completado depois; a
 * cidade, se ficar em branco, só é notada no fechamento do mês — quando já não dá para perguntar.
 *
 * O endereço é dado pessoal: nunca vai para log (spec §4.4) nem para o DTO do Modelista.
 */
export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  static create(input: {
    zipCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city: string;
    state: string;
  }): Address {
    const city = (input.city ?? '').trim();
    if (city.length < 2 || city.length > 120) {
      throw new InvalidValueException('Cidade é obrigatória.');
    }

    const state = (input.state ?? '').trim().toUpperCase();
    if (!(UF as readonly string[]).includes(state)) {
      throw new InvalidValueException('UF inválida.');
    }

    const zipCode = (input.zipCode ?? '').replace(/\D/g, '') || null;
    if (zipCode && zipCode.length !== 8) {
      throw new InvalidValueException('CEP deve ter 8 dígitos.');
    }

    return new Address({
      zipCode,
      street: input.street?.trim() || null,
      number: input.number?.trim() || null,
      complement: input.complement?.trim() || null,
      district: input.district?.trim() || null,
      city,
      state,
    });
  }

  get zipCode(): string | null {
    return this.props.zipCode;
  }

  get street(): string | null {
    return this.props.street;
  }

  get number(): string | null {
    return this.props.number;
  }

  get complement(): string | null {
    return this.props.complement;
  }

  get district(): string | null {
    return this.props.district;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }
}
