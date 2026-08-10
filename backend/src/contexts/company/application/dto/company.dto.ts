import { Company } from '../../domain/entities/company.entity';

export class CompanyStateRegistrationDto {
  state!: string;
  registration!: string;
}

export class CompanyDto {
  id!: string;
  legalName!: string;
  tradeName!: string | null;
  displayName!: string;
  document!: string;
  documentFormatted!: string;
  stateRegistration!: string | null;
  stateRegistrationExempt!: boolean;
  municipalRegistration!: string | null;
  suframa!: string | null;
  cnae!: string | null;
  taxRegime!: string;
  address!: {
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    ibgeCityCode: string | null;
  };
  contactEmail!: string | null;
  billingEmail!: string | null;
  phone!: string | null;
  stateRegistrations!: CompanyStateRegistrationDto[];
  logoObjectKey!: string | null;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(company: Company): CompanyDto {
    const dto = new CompanyDto();
    dto.id = company.id.value;
    dto.legalName = company.legalName;
    dto.tradeName = company.tradeName;
    dto.displayName = company.displayName;
    dto.document = company.document.value;
    dto.documentFormatted = company.document.formatted;
    dto.stateRegistration = company.fiscal.stateRegistration;
    dto.stateRegistrationExempt = company.fiscal.stateRegistrationExempt;
    dto.municipalRegistration = company.fiscal.municipalRegistration;
    dto.suframa = company.fiscal.suframa;
    dto.cnae = company.fiscal.cnae;
    dto.taxRegime = company.fiscal.taxRegime;
    dto.address = {
      street: company.address.street,
      number: company.address.number,
      complement: company.address.complement,
      district: company.address.district,
      city: company.address.city,
      state: company.address.state,
      zipCode: company.address.zipCode,
      ibgeCityCode: company.address.ibgeCityCode,
    };
    dto.contactEmail = company.contactEmail?.value ?? null;
    dto.billingEmail = company.billingEmail?.value ?? null;
    dto.phone = company.phone?.value ?? null;
    dto.stateRegistrations = company.stateRegistrations.map((registration) => ({
      state: registration.state,
      registration: registration.registration,
    }));
    dto.logoObjectKey = company.logoObjectKey;
    dto.active = company.active;
    dto.createdAt = company.createdAt;
    return dto;
  }
}
