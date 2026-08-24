import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  BillingPayerInfo,
  BillingPayerLookupPort,
} from '../../../../contexts/billing/application/ports/output/billing-support.ports';
import { ContactOrmEntity } from '../entities/contact-orm.entity';

/**
 * O pagador do boleto e o destinatário da régua, lidos do contato — o COB não depende do módulo de
 * Contato inteiro (mesmo desenho do CustomerLookup do VND). Tenant via filtro global + RLS.
 */
@Injectable()
export class BillingContactLookup implements BillingPayerLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findByContactId(contactId: string): Promise<BillingPayerInfo | null> {
    const row = await this.em.findOne(
      ContactOrmEntity,
      { id: contactId },
      { populate: ['emails', 'phones'] },
    );
    if (!row) {
      return null;
    }
    const phones = row.phones.getItems().filter((phone) => !phone.deletedAt);
    const whatsapp = phones.find((phone) => phone.isWhatsapp) ?? phones[0] ?? null;
    const email = row.emails.getItems().find((entry) => !entry.deletedAt) ?? null;
    return {
      name: row.tradeName ?? row.legalName,
      document: row.document,
      email: email ? email.email : null,
      whatsapp: whatsapp ? whatsapp.phone : null,
    };
  }
}
