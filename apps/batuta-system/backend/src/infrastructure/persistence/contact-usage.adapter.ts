import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ContactUsagePort } from '../../contexts/audience/application/ports/output/contact-usage.port';
import { DispatchOrmEntity } from './mikro-orm/entities/dispatch-orm.entity';

/**
 * Tells the audience context whether a contact already appears in a send.
 *
 * The seam exists so deleting a contact can explain itself. Without it the only feedback would be the
 * foreign key on `dispatches` refusing at flush time — a generic 500 that tells the operator nothing
 * about what to do instead. With it, the refusal names the number of sends and points at the
 * alternative.
 *
 * Counting through the ORM keeps the global tenant filter applied: sends of another account are not
 * visible here, so they can neither block nor permit a deletion in this one.
 */
@Injectable()
export class ContactUsageAdapter implements ContactUsagePort {
  constructor(private readonly em: EntityManager) {}

  async countDispatches(contactId: string): Promise<number> {
    return this.em.count(DispatchOrmEntity, { contactId });
  }
}
