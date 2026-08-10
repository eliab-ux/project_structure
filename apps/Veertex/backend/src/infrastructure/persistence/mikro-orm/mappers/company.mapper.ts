import { Injectable } from '@nestjs/common';
import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Document } from '../../../../shared/domain/value-objects/document.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { Company } from '../../../../contexts/company/domain/entities/company.entity';
import { CompanyId } from '../../../../contexts/company/domain/value-objects/company-id.vo';
import { StateRegistration } from '../../../../contexts/company/domain/value-objects/state-registration.vo';
import { CompanyOrmEntity } from '../entities/company-orm.entity';

@Injectable()
export class CompanyMapper {
  toDomain(orm: CompanyOrmEntity): Company {
    return Company.reconstitute({
      id: CompanyId.from(orm.id),
      accountId: orm.accountId,
      legalName: orm.legalName,
      tradeName: orm.tradeName,
      document: Document.cnpj(orm.document),
      fiscal: {
        stateRegistration: orm.stateRegistration,
        stateRegistrationExempt: orm.stateRegistrationExempt,
        municipalRegistration: orm.municipalRegistration,
        suframa: orm.suframa,
        cnae: orm.cnae,
        taxRegime: orm.taxRegime,
      },
      address: Address.create({
        street: orm.addressStreet,
        number: orm.addressNumber,
        complement: orm.addressComplement,
        district: orm.addressDistrict,
        city: orm.addressCity,
        state: orm.addressState,
        zipCode: orm.addressZipCode,
        ibgeCityCode: orm.addressIbgeCityCode,
      }),
      contactEmail: orm.contactEmail ? Email.create(orm.contactEmail) : null,
      billingEmail: orm.billingEmail ? Email.create(orm.billingEmail) : null,
      phone: orm.phone ? PhoneE164.create(orm.phone) : null,
      stateRegistrations: (orm.stRegistrations ?? []).map((row) =>
        StateRegistration.create(row.state, row.registration),
      ),
      logoObjectKey: orm.logoObjectKey,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(company: Company): Record<string, unknown> {
    return {
      id: company.id.value,
      accountId: company.accountId,
      legalName: company.legalName,
      tradeName: company.tradeName,
      document: company.document.value,
      stateRegistration: company.fiscal.stateRegistration,
      stateRegistrationExempt: company.fiscal.stateRegistrationExempt,
      municipalRegistration: company.fiscal.municipalRegistration,
      suframa: company.fiscal.suframa,
      cnae: company.fiscal.cnae,
      taxRegime: company.fiscal.taxRegime,
      addressStreet: company.address.street,
      addressNumber: company.address.number,
      addressComplement: company.address.complement,
      addressDistrict: company.address.district,
      addressCity: company.address.city,
      addressState: company.address.state,
      addressZipCode: company.address.zipCode,
      addressIbgeCityCode: company.address.ibgeCityCode,
      contactEmail: company.contactEmail?.value ?? null,
      billingEmail: company.billingEmail?.value ?? null,
      phone: company.phone?.value ?? null,
      stRegistrations: company.stateRegistrations.map((registration) => ({
        state: registration.state,
        registration: registration.registration,
      })),
      logoObjectKey: company.logoObjectKey,
      active: company.active,
      createdAt: company.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    };
  }
}
