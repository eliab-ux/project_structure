import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ContactOrmEntity } from './contact-orm.entity';

/**
 * Um telefone de um contato — tabela filha, e é a que justifica a escolha por tabela em vez de
 * `jsonb`: no balcão, buscar o cliente pelo telefone é o caso de uso mais comum, e busca dentro de
 * `jsonb` envelhece mal (índice de expressão, sintaxe própria, e nada disso aparece no plano de
 * quem só quer um `where`).
 *
 * `account_id` próprio + policy de RLS própria — ver `ContactEmailOrmEntity`.
 */
@Entity({ tableName: 'contact_phones' })
export class ContactPhoneOrmEntity extends TenantScopedOrmEntity {
  @ManyToOne(() => ContactOrmEntity, { fieldName: 'contact_id', deleteRule: 'cascade' })
  contact!: ContactOrmEntity;

  /** E.164 (`+5562999990001`) — garantido pelo VO `PhoneE164`. */
  @Index()
  @Property({ length: 20 })
  phone!: string;

  @Property({ length: 60, nullable: true })
  label!: string | null;

  @Property({ type: 'boolean', default: false, fieldName: 'is_whatsapp' })
  isWhatsapp = false;
}
