import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';

interface ReportOwnerProps {
  name: string;
  role: string | null;
  phone: PhoneE164 | null;
  email: Email | null;
}

/**
 * Responsável pelo relatório mensal (spec §4.1). É quem a associação (APL) procura quando o
 * relatório do governo tem pergunta — por isso vive junto, e não espalhado em quatro colunas soltas
 * que podem ser preenchidas pela metade sem ninguém notar.
 *
 * O bloco inteiro é opcional: conta recém-criada ainda não sabe quem vai assinar o relatório. Mas
 * se existir, o nome existe — responsável sem nome é o mesmo que responsável nenhum, com a
 * desvantagem de parecer preenchido.
 */
export class ReportOwner extends ValueObject<ReportOwnerProps> {
  private constructor(props: ReportOwnerProps) {
    super(props);
  }

  static create(input: {
    name: string;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
  }): ReportOwner {
    const name = (input.name ?? '').trim();
    if (name.length < 2) {
      throw new InvalidValueException('Nome do responsável pelo relatório é obrigatório.');
    }

    return new ReportOwner({
      name,
      role: input.role?.trim() || null,
      phone: input.phone ? PhoneE164.create(input.phone) : null,
      email: input.email ? Email.create(input.email) : null,
    });
  }

  get name(): string {
    return this.props.name;
  }

  get role(): string | null {
    return this.props.role;
  }

  get phone(): PhoneE164 | null {
    return this.props.phone;
  }

  get email(): Email | null {
    return this.props.email;
  }
}
