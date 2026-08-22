import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager, FilterQuery } from '@mikro-orm/core';
import {
  ContactRepositoryPort,
  ListContactsFilter,
} from '../../../../contexts/contact/application/ports/output/contact-repository.port';
import { Contact } from '../../../../contexts/contact/domain/entities/contact.entity';
import { ContactId } from '../../../../contexts/contact/domain/value-objects/contact-id.vo';
import { ContactOrmEntity } from '../entities/contact-orm.entity';
import { ContactAddressOrmEntity } from '../entities/contact-address-orm.entity';
import { ContactEmailOrmEntity } from '../entities/contact-email-orm.entity';
import { ContactPhoneOrmEntity } from '../entities/contact-phone-orm.entity';
import { ContactMapper } from '../mappers/contact.mapper';

/**
 * Repositório de contatos.
 *
 * Como nos demais: **nenhum método recebe `accountId`**. O filtro global do MikroORM e a policy de
 * RLS escopam toda leitura, e não há o que esquecer de passar.
 */
@Injectable()
export class MikroOrmContactRepository implements ContactRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ContactMapper,
  ) {}

  async findById(id: ContactId): Promise<Contact | null> {
    const orm = await this.em.findOne(ContactOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByDocument(document: string, exceptId?: ContactId): Promise<Contact | null> {
    const where: FilterQuery<ContactOrmEntity> = exceptId
      ? { document, id: { $ne: exceptId.value } }
      : { document };
    const orm = await this.em.findOne(ContactOrmEntity, where);
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCode(code: string, exceptId?: ContactId): Promise<Contact | null> {
    const where: FilterQuery<ContactOrmEntity> = exceptId
      ? { code, id: { $ne: exceptId.value } }
      : { code };
    const orm = await this.em.findOne(ContactOrmEntity, where);
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async list(filter: ListContactsFilter): Promise<Contact[]> {
    const where: FilterQuery<ContactOrmEntity> = {};

    if (!filter.includeInactive) {
      Object.assign(where, { active: true });
    }
    if (filter.type) {
      // `$contains` vira `types @> ARRAY[...]` — a operação que o índice GIN atende.
      Object.assign(where, { types: { $contains: [filter.type] } });
    }
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      const digits = filter.search.replace(/\D/g, '');
      const or: FilterQuery<ContactOrmEntity>[] = [
        { legalName: { $ilike: term } },
        { tradeName: { $ilike: term } },
      ];
      // Documento e telefone são buscados por DÍGITOS: o operador digita "62 99999-0001" e o banco
      // guarda "+5562999990001". Comparar o texto cru não acharia nada, e o usuário concluiria que
      // o contato não existe.
      if (digits.length >= 3) {
        or.push({ document: { $like: `%${digits}%` } });
        or.push({ phones: { phone: { $like: `%${digits}%` } } });
      }
      Object.assign(where, { $or: or });
    }

    const rows = await this.em.find(ContactOrmEntity, where, { orderBy: { legalName: 'ASC' } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  /**
   * Grava o contato e **sincroniza as coleções**.
   *
   * `em.upsert` — usado nos outros repositórios — não serve aqui: ele resolve escalares e ignora
   * filhos, e o resultado seria um contato salvo com os e-mails antigos.
   *
   * A sincronização é por SUBSTITUIÇÃO: as linhas atuais saem, as novas entram. É a semântica que o
   * formulário produz (a tela manda a lista inteira que o usuário vê) e evita ter de carregar id por
   * linha até a interface.
   *
   * **As que saem levam `deleted_at`, não DELETE.** `orphanRemoval` do MikroORM emitiria DELETE, e o
   * papel de runtime não tem DELETE — invariante que o `verify:isolation` verifica e que existe para
   * que uma falha na aplicação não consiga apagar dado de cliente. Enfraquecê-lo para facilitar a
   * sincronização de um formulário seria trocar proteção real por conveniência. O custo é lixo
   * invisível: um contato editado muitas vezes deixa linhas mortas, filtradas na leitura.
   *
   * Cada filho recebe `accountId` explicitamente. Sem isso a coluna iria nula e a policy de RLS
   * recusaria o INSERT — que é o comportamento correto da policy, e o bug seria nosso.
   */
  async save(contact: Contact): Promise<Contact> {
    let orm = await this.em.findOne(ContactOrmEntity, { id: contact.id.value });

    if (!orm) {
      orm = this.em.create(ContactOrmEntity, {
        id: contact.id.value,
        accountId: contact.accountId,
        types: [...contact.types],
        personKind: contact.personKind,
        legalName: contact.legalName,
        tradeName: contact.tradeName,
        document: contact.document?.value ?? null,
        stateRegistration: contact.stateRegistration,
        code: contact.code,
        creditLimit: contact.creditLimit === null ? null : contact.creditLimit.toFixed(2),
        salesRepId: contact.salesRepId,
        notes: contact.notes,
        municipalRegistration: contact.optional.municipalRegistration,
        suframa: contact.optional.suframa,
        gln: contact.optional.gln,
        pixKey: contact.optional.pixKey,
        website: contact.optional.website,
        active: contact.active,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      });
      this.em.persist(orm);
    } else {
      this.mapper.applyScalars(orm, contact);
    }

    const accountId = contact.accountId;
    // As linhas filhas são recriadas a cada gravação (substituição, não merge), então a data de
    // criação delas é sempre agora — é a data da LINHA, não a do contato.
    const now = new Date();

    for (const antiga of orm.emails.getItems()) {
      antiga.deletedAt = now;
    }
    for (const entry of contact.emails) {
      orm.emails.add(
        this.em.create(ContactEmailOrmEntity, {
          accountId,
          id: randomUUID(),
          contact: orm,
          email: entry.email.value,
          label: entry.label,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    for (const antiga of orm.phones.getItems()) {
      antiga.deletedAt = now;
    }
    for (const entry of contact.phones) {
      orm.phones.add(
        this.em.create(ContactPhoneOrmEntity, {
          accountId,
          id: randomUUID(),
          contact: orm,
          phone: entry.phone.value,
          label: entry.label,
          isWhatsapp: entry.isWhatsapp,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    for (const antiga of orm.addresses.getItems()) {
      antiga.deletedAt = now;
    }
    for (const entry of contact.addresses) {
      orm.addresses.add(
        this.em.create(ContactAddressOrmEntity, {
          accountId,
          id: randomUUID(),
          contact: orm,
          purpose: entry.purpose,
          street: entry.address.street,
          number: entry.address.number,
          complement: entry.address.complement,
          district: entry.address.district,
          city: entry.address.city,
          state: entry.address.state,
          zipCode: entry.address.zipCode,
          ibgeCityCode: entry.address.ibgeCityCode,
          latitude: entry.latitude === null ? null : String(entry.latitude),
          longitude: entry.longitude === null ? null : String(entry.longitude),
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}
