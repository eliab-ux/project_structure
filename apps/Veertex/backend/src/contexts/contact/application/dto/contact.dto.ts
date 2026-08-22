import { Contact } from '../../domain/entities/contact.entity';
import { AddressPurpose } from '../../domain/entities/contact.entity';
import { ContactType, PersonKind } from '../../domain/contact-types';

export interface ContactAddressDto {
  purpose: AddressPurpose;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  ibgeCityCode: string | null;
  /** Sempre `null` nesta fatia — a geocodificação exige BullMQ, que é dependência nova. */
  latitude: number | null;
  longitude: number | null;
}

/**
 * O contato como o cliente HTTP o vê.
 *
 * Mapeamento explícito, campo a campo (`CLAUDE.md`): devolver a entidade exporia os value objects e
 * amarraria o contrato à forma interna. E documento sai **formatado e cru** — a tela precisa exibir
 * `12.345.678/0001-95` e comparar por dígitos.
 */
export class ContactDto {
  id!: string;
  types!: ContactType[];
  personKind!: PersonKind;
  legalName!: string;
  tradeName!: string | null;
  displayName!: string;
  document!: string | null;
  documentFormatted!: string | null;
  documentType!: string | null;
  stateRegistration!: string | null;
  code!: string | null;
  creditLimit!: number | null;
  /** Vendedor vinculado (carteirização, §2.3). `null` = sem carteira. */
  salesRepId!: string | null;
  notes!: string | null;
  municipalRegistration!: string | null;
  suframa!: string | null;
  gln!: string | null;
  pixKey!: string | null;
  website!: string | null;
  emails!: { email: string; label: string | null }[];
  phones!: { phone: string; masked: string; label: string | null; isWhatsapp: boolean }[];
  addresses!: ContactAddressDto[];
  active!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(contact: Contact): ContactDto {
    const dto = new ContactDto();
    dto.id = contact.id.value;
    dto.types = [...contact.types];
    dto.personKind = contact.personKind;
    dto.legalName = contact.legalName;
    dto.tradeName = contact.tradeName;
    dto.displayName = contact.displayName;
    dto.document = contact.document?.value ?? null;
    dto.documentFormatted = contact.document?.formatted ?? null;
    dto.documentType = contact.document?.type ?? null;
    dto.stateRegistration = contact.stateRegistration;
    dto.code = contact.code;
    dto.creditLimit = contact.creditLimit;
    dto.salesRepId = contact.salesRepId;
    dto.notes = contact.notes;
    dto.municipalRegistration = contact.optional.municipalRegistration;
    dto.suframa = contact.optional.suframa;
    dto.gln = contact.optional.gln;
    dto.pixKey = contact.optional.pixKey;
    dto.website = contact.optional.website;
    dto.emails = contact.emails.map((entry) => ({
      email: entry.email.value,
      label: entry.label,
    }));
    dto.phones = contact.phones.map((entry) => ({
      phone: entry.phone.value,
      masked: entry.phone.masked,
      label: entry.label,
      isWhatsapp: entry.isWhatsapp,
    }));
    dto.addresses = contact.addresses.map((entry) => ({
      purpose: entry.purpose,
      street: entry.address.street,
      number: entry.address.number,
      complement: entry.address.complement,
      district: entry.address.district,
      city: entry.address.city,
      state: entry.address.state,
      zipCode: entry.address.zipCode,
      ibgeCityCode: entry.address.ibgeCityCode,
      latitude: entry.latitude,
      longitude: entry.longitude,
    }));
    dto.active = contact.active;
    dto.createdAt = contact.createdAt;
    dto.updatedAt = contact.updatedAt;
    return dto;
  }
}
