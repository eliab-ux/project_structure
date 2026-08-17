import { CustomerData } from '../../domain/entities/customer.entity';
import { CustomerDocument } from '../../domain/value-objects/customer-document.vo';
import { Address } from '../../domain/value-objects/address.vo';
import { LegalRepresentative } from '../../domain/value-objects/legal-representative.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { CompanySize } from '../../domain/entities/customer.entity';

/** Forma crua vinda do HTTP — strings, do jeito que o operador digita. */
export interface CustomerInput {
  legalName: string;
  tradeName: string;
  documentType: string;
  document: string;
  stateRegistration?: string | null;
  companySize?: string | null;
  employeesCount?: number | null;

  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;

  repName: string;
  repRole?: string | null;
  repCpf: string;
  repPhone: string;
  repEmail: string;

  whatsapp: string;
  email?: string | null;
  phone?: string | null;

  isMember?: boolean;
  memberSince?: string | null;
  notes?: string | null;
}

/**
 * Converte a entrada crua nos Value Objects do domínio.
 *
 * Vive fora dos use cases porque criar e editar usam exatamente a mesma conversão — e é aqui que
 * cada campo encontra a sua validação de invariante (dígito verificador do documento, UF real,
 * telefone em E.164). Duplicar isso nos dois use cases significaria, mais cedo ou mais tarde,
 * duas regras diferentes para o mesmo campo.
 */
export function toCustomerData(input: CustomerInput): CustomerData {
  return {
    legalName: input.legalName,
    tradeName: input.tradeName,
    document: CustomerDocument.create(input.documentType, input.document),
    stateRegistration: input.stateRegistration ?? null,
    companySize: (input.companySize as CompanySize | null | undefined) ?? null,
    employeesCount: input.employeesCount ?? null,
    address: Address.create({
      zipCode: input.zipCode,
      street: input.street,
      number: input.number,
      complement: input.complement,
      district: input.district,
      city: input.city,
      state: input.state,
    }),
    representative: LegalRepresentative.create({
      name: input.repName,
      role: input.repRole,
      cpf: input.repCpf,
      phone: input.repPhone,
      email: input.repEmail,
    }),
    contact: {
      whatsapp: PhoneE164.create(input.whatsapp),
      email: input.email ? Email.create(input.email) : null,
      phone: input.phone ? PhoneE164.create(input.phone) : null,
    },
    membership: {
      isMember: input.isMember ?? false,
      memberSince: parseMemberSince(input.memberSince),
    },
    notes: input.notes ?? null,
  };
}

/** 'YYYY-MM-DD' → Date. Sem hora: é uma data de calendário, não um instante. */
function parseMemberSince(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidValueException('Data de associação deve estar no formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidValueException('Data de associação inválida.');
  }
  return date;
}
