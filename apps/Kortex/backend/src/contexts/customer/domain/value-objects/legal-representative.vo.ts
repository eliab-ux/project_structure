import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { CPF } from '../../../../shared/domain/value-objects/cpf.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';

export const REPRESENTATIVE_ROLES = ['president', 'partner', 'owner', 'other'] as const;
export type RepresentativeRole = (typeof REPRESENTATIVE_ROLES)[number];

export const REPRESENTATIVE_ROLE_LABELS: Record<RepresentativeRole, string> = {
  president: 'Presidente',
  partner: 'Sócio',
  owner: 'Proprietário',
  other: 'Outro',
};

interface LegalRepresentativeProps {
  name: string;
  role: RepresentativeRole | null;
  cpf: CPF;
  phone: PhoneE164;
  email: Email;
}

/**
 * Representante legal da confecção (spec §4.4).
 *
 * Todos os campos são obrigatórios menos o cargo, e o motivo é a prestação de contas: a operação
 * é conduzida por uma associação (APL), e `rep_name` é literalmente a coluna "EMPRESÁRIO" do
 * relatório do governo.
 *
 * O `cpf` aqui é **dado pessoal sensível**: nunca em log, nunca em DTO de listagem, só no DTO de
 * detalhe e só para `admin`/`owner`.
 */
export class LegalRepresentative extends ValueObject<LegalRepresentativeProps> {
  private constructor(props: LegalRepresentativeProps) {
    super(props);
  }

  static create(input: {
    name: string;
    role?: string | null;
    cpf: string;
    phone: string;
    email: string;
  }): LegalRepresentative {
    const name = (input.name ?? '').trim();
    if (name.length < 2 || name.length > 200) {
      throw new InvalidValueException('Nome do representante legal é obrigatório.');
    }

    let role: RepresentativeRole | null = null;
    if (input.role) {
      if (!(REPRESENTATIVE_ROLES as readonly string[]).includes(input.role)) {
        throw new InvalidValueException('Cargo do representante inválido.');
      }
      role = input.role as RepresentativeRole;
    }

    return new LegalRepresentative({
      name,
      role,
      cpf: CPF.create(input.cpf),
      phone: PhoneE164.create(input.phone),
      email: Email.create(input.email),
    });
  }

  get name(): string {
    return this.props.name;
  }

  get role(): RepresentativeRole | null {
    return this.props.role;
  }

  get cpf(): CPF {
    return this.props.cpf;
  }

  get phone(): PhoneE164 {
    return this.props.phone;
  }

  get email(): Email {
    return this.props.email;
  }
}
