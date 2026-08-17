import { Customer, CompanySize, CustomerStatus } from '../../domain/entities/customer.entity';
import { DocumentType } from '../../domain/value-objects/customer-document.vo';
import { RepresentativeRole } from '../../domain/value-objects/legal-representative.vo';

/**
 * Cliente na LISTAGEM — a tela de Clientes do Administrativo.
 *
 * **Não tem número de documento nenhum**, e a ausência é a regra, não economia de campo. O DoD da
 * Fase 2 exige que a listagem não contenha CPF, e o documento do cliente PODE ser um CPF
 * (`document_type = 'cpf'`, para a costureira autônoma sem CNPJ). Mapear "só o CNPJ" seria uma
 * regra que funciona até o primeiro cliente pessoa física — e aí publicaria um CPF numa listagem
 * sem ninguém notar.
 *
 * `documentType` fica: diz se o cliente é PJ ou PF sem revelar o número.
 */
export class CustomerListDto {
  id!: string;
  tradeName!: string;
  documentType!: DocumentType;
  city!: string;
  state!: string;
  whatsapp!: string;
  isMember!: boolean;
  status!: CustomerStatus;

  static fromDomain(customer: Customer): CustomerListDto {
    const dto = new CustomerListDto();
    dto.id = customer.id.value;
    dto.tradeName = customer.tradeName;
    dto.documentType = customer.document.type;
    dto.city = customer.address.city;
    dto.state = customer.address.state;
    dto.whatsapp = customer.contact.whatsapp.value;
    dto.isMember = customer.membership.isMember;
    dto.status = customer.status;
    // Ausentes de propósito: document, rep_cpf, endereço completo, representante.
    return dto;
  }
}

/**
 * Cliente para o papel `modelista` (spec §4.4).
 *
 * Exatamente quatro campos, mais o id para poder referenciá-lo num pré-pedido. Sem CPF, sem CNPJ,
 * sem endereço, sem representante: ele não precisa, e menor privilégio se aplica a dado pessoal do
 * mesmo jeito que a dinheiro.
 */
export class CustomerForModelistaDto {
  id!: string;
  tradeName!: string;
  city!: string;
  whatsapp!: string;
  notes!: string | null;

  static fromDomain(customer: Customer): CustomerForModelistaDto {
    const dto = new CustomerForModelistaDto();
    dto.id = customer.id.value;
    dto.tradeName = customer.tradeName;
    dto.city = customer.address.city;
    dto.whatsapp = customer.contact.whatsapp.value;
    dto.notes = customer.notes;
    return dto;
  }
}

/** Cliente completo — tela de detalhe, servida apenas a `admin` e `owner`. */
export class CustomerDetailDto {
  id!: string;
  legalName!: string;
  tradeName!: string;
  documentType!: DocumentType;
  document!: string;
  documentFormatted!: string;
  stateRegistration!: string | null;
  companySize!: CompanySize | null;
  employeesCount!: number | null;
  status!: CustomerStatus;

  address!: {
    zipCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string;
    state: string;
  };

  representative!: {
    name: string;
    role: RepresentativeRole | null;
    cpf: string;
    cpfFormatted: string;
    phone: string;
    email: string;
  };

  contact!: {
    whatsapp: string;
    email: string | null;
    phone: string | null;
  };

  isMember!: boolean;
  memberSince!: string | null;
  notes!: string | null;

  static fromDomain(customer: Customer): CustomerDetailDto {
    const dto = new CustomerDetailDto();
    dto.id = customer.id.value;
    dto.legalName = customer.legalName;
    dto.tradeName = customer.tradeName;
    dto.documentType = customer.document.type;
    dto.document = customer.document.value;
    dto.documentFormatted = customer.document.formatted;
    dto.stateRegistration = customer.stateRegistration;
    dto.companySize = customer.companySize;
    dto.employeesCount = customer.employeesCount;
    dto.status = customer.status;

    const address = customer.address;
    dto.address = {
      zipCode: address.zipCode,
      street: address.street,
      number: address.number,
      complement: address.complement,
      district: address.district,
      city: address.city,
      state: address.state,
    };

    const rep = customer.representative;
    dto.representative = {
      name: rep.name,
      role: rep.role,
      // O CPF do representante sai daqui e SÓ daqui — nunca da listagem, nunca do DTO do
      // Modelista, nunca de log (spec §4.4).
      cpf: rep.cpf.value,
      cpfFormatted: rep.cpf.formatted,
      phone: rep.phone.value,
      email: rep.email.value,
    };

    dto.contact = {
      whatsapp: customer.contact.whatsapp.value,
      email: customer.contact.email?.value ?? null,
      phone: customer.contact.phone?.value ?? null,
    };

    dto.isMember = customer.membership.isMember;
    dto.memberSince = customer.membership.memberSince
      ? customer.membership.memberSince.toISOString().slice(0, 10)
      : null;
    dto.notes = customer.notes;
    return dto;
  }
}
