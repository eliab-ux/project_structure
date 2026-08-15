import { Collection, Entity, Index, OneToMany, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ContactAddressOrmEntity } from './contact-address-orm.entity';
import { ContactEmailOrmEntity } from './contact-email-orm.entity';
import { ContactPhoneOrmEntity } from './contact-phone-orm.entity';

/**
 * O contato — cadastro único com TIPOS MÚLTIPLOS (§3.4 do CORE).
 *
 * **`types` é `text[]` com índice GIN** (decisão de Eliab, 14/08/2026). A alternativa era tabela de
 * junção; o array ganhou porque o dado é um conjunto pequeno e fechado de quatro valores, sempre
 * lido junto com o contato, e o filtro da tela é "tem este tipo?" — que o GIN resolve com
 * `types @> ARRAY['customer']` sem join. Tabela de junção pagaria um join em toda listagem para
 * modelar uma cardinalidade que nunca passa de quatro.
 *
 * **Unicidade de documento por conta** — o índice único é `(account_id, document)`, e não só
 * `document`: contas diferentes podem ter o mesmo cliente, e devem. O default "não permitir
 * duplicado dentro da conta" foi decidido por Eliab (o §3.4 prevê que vire preferência da conta).
 *
 * ⚠️ **Não existe coluna de vendedor vinculado.** Ver o docblock da entidade de domínio: coluna de
 * carteirização sem o filtro que a aplica é a pior configuração possível, porque alguém depois supõe
 * que ela restringe algo — e ela não restringe nada.
 */
@Entity({ tableName: 'contacts' })
@Unique({ properties: ['accountId', 'document'] })
@Unique({ properties: ['accountId', 'code'] })
export class ContactOrmEntity extends TenantScopedOrmEntity {
  /** `customer | supplier | carrier | reseller` — validados pelo domínio, nunca pelo banco. */
  @Property({ type: 'text[]' })
  types!: string[];

  @Property({ length: 20, fieldName: 'person_kind' })
  personKind!: string;

  @Index()
  @Property({ length: 200, fieldName: 'legal_name' })
  legalName!: string;

  @Property({ length: 200, nullable: true, fieldName: 'trade_name' })
  tradeName!: string | null;

  /** Só dígitos — CPF (11) ou CNPJ (14). O VO `Document` garante o formato. */
  @Index()
  @Property({ length: 14, nullable: true })
  document!: string | null;

  @Property({ length: 30, nullable: true, fieldName: 'state_registration' })
  stateRegistration!: string | null;

  /** Código do contato. Manual nesta fatia — sequencial é preferência de conta, que não existe. */
  @Property({ length: 30, nullable: true })
  code!: string | null;

  /**
   * ⚠️ Guardado, **não aplicado**. O §3.4 diz que ele bloqueia venda acima, e quem aplica são os
   * módulos VND/COB, que não existem. A TELA diz isso ao operador (ver o `hint` no catálogo de
   * campos) — sem esse aviso, um número aqui é promessa de bloqueio que o sistema não cumpre.
   *
   * `decimal` e não `float`: dinheiro em ponto flutuante soma errado, e soma errada de limite de
   * crédito aparece como venda liberada que não devia.
   */
  @Property({ type: 'decimal', precision: 14, scale: 2, nullable: true, fieldName: 'credit_limit' })
  creditLimit!: string | null;

  @Property({ type: 'text', nullable: true })
  notes!: string | null;

  // ── Opcionais do §3.4: colunas reais nullable, ocultas por default no catálogo de campos ──────
  @Property({ length: 30, nullable: true, fieldName: 'municipal_registration' })
  municipalRegistration!: string | null;

  @Property({ length: 30, nullable: true })
  suframa!: string | null;

  @Property({ length: 30, nullable: true })
  gln!: string | null;

  @Property({ length: 140, nullable: true, fieldName: 'pix_key' })
  pixKey!: string | null;

  @Property({ length: 200, nullable: true })
  website!: string | null;

  @Property({ type: 'boolean', default: true })
  active = true;

  @OneToMany(() => ContactEmailOrmEntity, (email) => email.contact, {
    // Sem `orphanRemoval`: ele emite DELETE, e o papel de runtime não tem DELETE. A remoção é
    // lógica (`deleted_at`), feita no repositório.
    eager: true,
  })
  emails = new Collection<ContactEmailOrmEntity>(this);

  @OneToMany(() => ContactPhoneOrmEntity, (phone) => phone.contact, {
    // Sem `orphanRemoval`: ele emite DELETE, e o papel de runtime não tem DELETE. A remoção é
    // lógica (`deleted_at`), feita no repositório.
    eager: true,
  })
  phones = new Collection<ContactPhoneOrmEntity>(this);

  @OneToMany(() => ContactAddressOrmEntity, (address) => address.contact, {
    // Sem `orphanRemoval`: ele emite DELETE, e o papel de runtime não tem DELETE. A remoção é
    // lógica (`deleted_at`), feita no repositório.
    eager: true,
  })
  addresses = new Collection<ContactAddressOrmEntity>(this);
}
