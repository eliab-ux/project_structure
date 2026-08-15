import { Contact } from '../../../domain/entities/contact.entity';
import { ContactType } from '../../../domain/contact-types';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';

export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');

export interface ListContactsFilter {
  /** Texto livre: casa com nome, fantasia, documento, e-mail ou telefone. */
  search?: string | null;
  /** Um tipo por vez — é o filtro da tela (§5 do CORE: "lista com filtros por tipo"). */
  type?: ContactType | null;
  includeInactive?: boolean;
}

/**
 * O repositório de contatos.
 *
 * **Nenhum método recebe `accountId`, e a ausência é a garantia.** O escopo de tenant é
 * estabelecido pelo `JwtAuthGuard` na transação da requisição e aplicado em duas camadas — filtro
 * global do MikroORM e RLS no Postgres. Um parâmetro `accountId` aqui seria uma terceira fonte de
 * verdade sobre "de quem é este dado", e a terceira sempre é a que alguém esquece de passar.
 */
export interface ContactRepositoryPort {
  findById(id: ContactId): Promise<Contact | null>;
  /** Para a regra de documento único por conta. Ignora o próprio contato na edição. */
  findByDocument(document: string, exceptId?: ContactId): Promise<Contact | null>;
  findByCode(code: string, exceptId?: ContactId): Promise<Contact | null>;
  list(filter: ListContactsFilter): Promise<Contact[]>;
  save(contact: Contact): Promise<Contact>;
}
