import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  PromissoryDebtorInfo,
  PromissoryDebtorLookupPort,
} from '../../../../contexts/route/application/ports/output/promissory-debtor-lookup.port';
import { ContactOrmEntity } from '../entities/contact-orm.entity';

/** Snapshot da devedora (nome/CPF) para a promissória. Escopado pelo tenant. */
@Injectable()
export class PromissoryDebtorLookup implements PromissoryDebtorLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findByContact(contactId: string): Promise<PromissoryDebtorInfo | null> {
    const contact = await this.em.findOne(
      ContactOrmEntity,
      { id: contactId },
      { fields: ['legalName', 'document'] },
    );
    if (!contact) {
      return null;
    }
    return { name: contact.legalName, document: contact.document };
  }
}
