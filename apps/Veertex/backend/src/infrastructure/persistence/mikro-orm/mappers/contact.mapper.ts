import { Injectable } from '@nestjs/common';
import { Address } from '../../../../shared/domain/value-objects/address.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import {
  Contact,
  AddressPurpose,
} from '../../../../contexts/contact/domain/entities/contact.entity';
import { ContactOrmEntity } from '../entities/contact-orm.entity';

/**
 * Domínio ↔ ORM para o contato.
 *
 * A conversão de `credit_limit` merece nota: o driver do Postgres devolve `decimal` como **string**,
 * de propósito — converter para `number` no driver perderia precisão em valores grandes. Aqui a
 * conversão é explícita e num lugar só; espalhá-la pelos use cases produziria dois entendimentos
 * sobre o mesmo dado.
 */
@Injectable()
export class ContactMapper {
  toDomain(orm: ContactOrmEntity): Contact {
    /*
     * `vivas()` e não `getItems()` direto: logo após uma gravação, a coleção em memória ainda contém
     * as linhas que acabaram de receber `deleted_at` — o filtro global só as remove numa leitura
     * nova. Sem este filtro, a resposta do POST/PATCH devolveria o telefone antigo junto com o novo.
     */
    return Contact.restore({
      id: orm.id,
      accountId: orm.accountId,
      types: orm.types,
      personKind: orm.personKind,
      legalName: orm.legalName,
      tradeName: orm.tradeName,
      document: orm.document,
      stateRegistration: orm.stateRegistration,
      code: orm.code,
      creditLimit: orm.creditLimit === null ? null : Number(orm.creditLimit),
      salesRepId: orm.salesRepId,
      routeId: orm.routeId,
      defaultPaymentConditionId: orm.defaultPaymentConditionId ?? null,
      notes: orm.notes,
      optional: {
        municipalRegistration: orm.municipalRegistration,
        suframa: orm.suframa,
        gln: orm.gln,
        pixKey: orm.pixKey,
        website: orm.website,
      },
      emails: vivas(orm.emails.getItems()).map((row) => ({
        email: Email.create(row.email),
        label: row.label,
      })),
      phones: vivas(orm.phones.getItems()).map((row) => ({
        phone: PhoneE164.create(row.phone),
        label: row.label,
        isWhatsapp: row.isWhatsapp,
      })),
      addresses: vivas(orm.addresses.getItems()).map((row) => ({
        purpose: row.purpose as AddressPurpose,
        address: Address.create({
          street: row.street,
          number: row.number,
          complement: row.complement,
          district: row.district,
          city: row.city,
          state: row.state,
          zipCode: row.zipCode,
          ibgeCityCode: row.ibgeCityCode,
        }),
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      })),
      active: orm.active,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  /** Só os escalares — as coleções são sincronizadas pelo repositório, que tem o EntityManager. */
  applyScalars(orm: ContactOrmEntity, contact: Contact): void {
    orm.accountId = contact.accountId;
    orm.types = [...contact.types];
    orm.personKind = contact.personKind;
    orm.legalName = contact.legalName;
    orm.tradeName = contact.tradeName;
    orm.document = contact.document?.value ?? null;
    orm.stateRegistration = contact.stateRegistration;
    orm.code = contact.code;
    orm.creditLimit = contact.creditLimit === null ? null : contact.creditLimit.toFixed(2);
    orm.salesRepId = contact.salesRepId;
    orm.routeId = contact.routeId;
    orm.defaultPaymentConditionId = contact.defaultPaymentConditionId;
    orm.notes = contact.notes;
    orm.municipalRegistration = contact.optional.municipalRegistration;
    orm.suframa = contact.optional.suframa;
    orm.gln = contact.optional.gln;
    orm.pixKey = contact.optional.pixKey;
    orm.website = contact.optional.website;
    orm.active = contact.active;
    orm.updatedAt = contact.updatedAt;
  }
}

/** Linhas filhas ainda não removidas logicamente. */
function vivas<T extends { deletedAt: Date | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt === null || row.deletedAt === undefined);
}
