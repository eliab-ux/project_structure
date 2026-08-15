import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ContactOrmEntity } from './contact-orm.entity';

/**
 * Um e-mail de um contato — tabela filha, não `jsonb`.
 *
 * **`account_id` PRÓPRIO, e não herdado pelo pai.** É a regra de isolamento deste sistema: toda
 * tabela de negócio carrega o tenant e tem policy de RLS própria. Confiar no `account_id` do
 * contato-pai faria o isolamento desta tabela depender de um JOIN — e RLS não segue join: uma query
 * direta em `contact_emails` não passaria por `contacts`, e leria tudo. O `verify:isolation` recusa
 * tabela sem policy exatamente para impedir esse desenho.
 */
@Entity({ tableName: 'contact_emails' })
export class ContactEmailOrmEntity extends TenantScopedOrmEntity {
  @ManyToOne(() => ContactOrmEntity, { fieldName: 'contact_id', deleteRule: 'cascade' })
  contact!: ContactOrmEntity;

  @Property({ length: 255 })
  email!: string;

  @Property({ length: 60, nullable: true })
  label!: string | null;
}
