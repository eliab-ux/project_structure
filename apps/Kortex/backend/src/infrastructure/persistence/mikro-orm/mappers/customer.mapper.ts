import { Injectable } from '@nestjs/common';
import {
  CompanySize,
  Customer,
  CustomerStatus,
} from '../../../../contexts/customer/domain/entities/customer.entity';
import { CustomerId } from '../../../../contexts/customer/domain/value-objects/customer-id.vo';
import { CustomerDocument } from '../../../../contexts/customer/domain/value-objects/customer-document.vo';
import { Address } from '../../../../contexts/customer/domain/value-objects/address.vo';
import { LegalRepresentative } from '../../../../contexts/customer/domain/value-objects/legal-representative.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { CustomerOrmEntity } from '../entities/customer-orm.entity';

@Injectable()
export class CustomerMapper {
  toDomain(orm: CustomerOrmEntity): Customer {
    return Customer.restore({
      id: CustomerId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      legalName: orm.legalName,
      tradeName: orm.tradeName,
      // Revalida o dígito verificador na volta do banco: um documento introduzido por SQL manual
      // não pode entrar em circulação sem passar pelo mesmo crivo do cadastro.
      document: CustomerDocument.create(orm.documentType, orm.document),
      stateRegistration: orm.stateRegistration,
      companySize: orm.companySize as CompanySize | null,
      employeesCount: orm.employeesCount,
      status: orm.status as CustomerStatus,
      address: Address.create({
        zipCode: orm.zipCode,
        street: orm.street,
        number: orm.number,
        complement: orm.complement,
        district: orm.district,
        city: orm.city,
        state: orm.state,
      }),
      representative: LegalRepresentative.create({
        name: orm.repName,
        role: orm.repRole,
        cpf: orm.repCpf,
        phone: orm.repPhone,
        email: orm.repEmail,
      }),
      contact: {
        whatsapp: PhoneE164.create(orm.whatsapp),
        email: orm.email ? Email.create(orm.email) : null,
        phone: orm.phone ? PhoneE164.create(orm.phone) : null,
      },
      membership: {
        isMember: orm.isMember,
        // 'AAAA-MM-DD' → Date em UTC. Sem o sufixo de fuso, o Node interpretaria a string como
        // horário LOCAL e a data poderia recuar um dia a oeste de Greenwich.
        memberSince: orm.memberSince ? new Date(`${orm.memberSince}T00:00:00.000Z`) : null,
      },
      notes: orm.notes,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Customer, target: CustomerOrmEntity = new CustomerOrmEntity()): CustomerOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.legalName = domain.legalName;
    target.tradeName = domain.tradeName;
    target.documentType = domain.document.type;
    target.document = domain.document.value;
    target.stateRegistration = domain.stateRegistration;
    target.companySize = domain.companySize;
    target.employeesCount = domain.employeesCount;
    target.status = domain.status;

    const address = domain.address;
    target.zipCode = address.zipCode;
    target.street = address.street;
    target.number = address.number;
    target.complement = address.complement;
    target.district = address.district;
    target.city = address.city;
    target.state = address.state;

    const rep = domain.representative;
    target.repName = rep.name;
    target.repRole = rep.role;
    target.repCpf = rep.cpf.value;
    target.repPhone = rep.phone.value;
    target.repEmail = rep.email.value;

    target.whatsapp = domain.contact.whatsapp.value;
    target.email = domain.contact.email?.value ?? null;
    target.phone = domain.contact.phone?.value ?? null;

    target.isMember = domain.membership.isMember;
    // Date → 'AAAA-MM-DD', o formato que a coluna `date` guarda.
    target.memberSince = domain.membership.memberSince
      ? domain.membership.memberSince.toISOString().slice(0, 10)
      : null;
    target.notes = domain.notes;

    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
