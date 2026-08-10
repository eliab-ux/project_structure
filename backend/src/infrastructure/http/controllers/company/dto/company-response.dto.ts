import { CompanyDto } from '../../../../../contexts/company/application/dto/company.dto';

export class CompanyResponseDto {
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
  address!: CompanyDto['address'];
  contactEmail!: string | null;
  billingEmail!: string | null;
  phone!: string | null;
  stateRegistrations!: { state: string; registration: string }[];
  active!: boolean;
  createdAt!: Date;

  /** Field by field. `logoObjectKey` is not exposed — it is a storage detail, not client data. */
  static from(company: CompanyDto): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = company.id;
    dto.legalName = company.legalName;
    dto.tradeName = company.tradeName;
    dto.displayName = company.displayName;
    dto.document = company.document;
    dto.documentFormatted = company.documentFormatted;
    dto.stateRegistration = company.stateRegistration;
    dto.stateRegistrationExempt = company.stateRegistrationExempt;
    dto.municipalRegistration = company.municipalRegistration;
    dto.suframa = company.suframa;
    dto.cnae = company.cnae;
    dto.taxRegime = company.taxRegime;
    dto.address = company.address;
    dto.contactEmail = company.contactEmail;
    dto.billingEmail = company.billingEmail;
    dto.phone = company.phone;
    dto.stateRegistrations = company.stateRegistrations;
    dto.active = company.active;
    dto.createdAt = company.createdAt;
    return dto;
  }
}
