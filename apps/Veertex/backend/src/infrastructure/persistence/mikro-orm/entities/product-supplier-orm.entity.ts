import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ProductOrmEntity } from './product-orm.entity';
import { ContactOrmEntity } from './contact-orm.entity';

/**
 * Um fornecedor de um produto — §3.5, "N por produto".
 *
 * ## Tabela, e não `jsonb`
 *
 * Mesma razão dos telefones do contato: este dado é **consultado do outro lado**. "Quais produtos eu
 * compro deste fornecedor?" é a pergunta da cotação de compras (CMP futuro), e ela parte do contato
 * para o produto. Dentro de `jsonb` isso exige índice de expressão e sintaxe própria — e nada disso
 * aparece no plano de quem só quer um `where`.
 *
 * ## `account_id` próprio, e não herdado por join
 *
 * A policy de RLS desta tabela lê a coluna DELA. Confiar no `account_id` do produto obrigaria a
 * policy a fazer join, e uma policy com join é uma policy que alguém simplifica um dia.
 *
 * ## `(product_id, contact_id)` único
 *
 * O mesmo fornecedor duas vezes no mesmo produto é sempre erro de digitação, e o resultado seria
 * custo duplicado na cotação. O domínio também recusa — as duas camadas, como sempre.
 */
@Entity({ tableName: 'product_suppliers' })
@Unique({ properties: ['product', 'contact'] })
export class ProductSupplierOrmEntity extends TenantScopedOrmEntity {
  @ManyToOne(() => ProductOrmEntity, { fieldName: 'product_id', deleteRule: 'cascade' })
  product!: ProductOrmEntity;

  /**
   * O contato fornecedor. **`deleteRule: 'restrict'`**: apagar um contato que é fornecedor de algum
   * produto deixaria o produto apontando para o nada. Como o sistema faz soft-delete, o caso normal
   * nem chega aqui — a restrição existe para o caminho anormal (um DELETE do papel owner numa
   * manutenção), que é justamente quando ninguém está olhando.
   */
  @Index()
  @ManyToOne(() => ContactOrmEntity, { fieldName: 'contact_id', deleteRule: 'restrict' })
  contact!: ContactOrmEntity;

  @Property({ length: 200, nullable: true, fieldName: 'supplier_description' })
  supplierDescription!: string | null;

  /** O código do item no catálogo DO FORNECEDOR — é o que vai no pedido de compra. */
  @Property({ length: 60, nullable: true, fieldName: 'supplier_sku' })
  supplierSku!: string | null;

  @Property({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  cost!: string | null;

  @Property({ type: 'boolean', default: false, fieldName: 'is_default' })
  isDefault = false;
}
