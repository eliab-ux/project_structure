import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Tabela GLOBAL — o catálogo de módulos da plataforma, igual para todo tenant, sem `account_id`.
 *
 * A autoridade sobre o que é um módulo está em `modules.catalog.ts`, no código: um módulo só existe
 * se houver código o implementando. Esta tabela é reconciliada pelo seed do boot e serve a duas
 * coisas que o código sozinho não dá — integridade referencial para `account_modules` e uma
 * listagem consultável por SQL para relatório e suporte.
 *
 * Como `plans`, tem policy de leitura liberada e escrita só do dono.
 */
@Entity({ tableName: 'modules' })
export class ModuleOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Index()
  @Property({ length: 20, unique: true })
  code!: string;

  @Property({ length: 120 })
  name!: string;

  @Property({ length: 300 })
  description!: string;

  /** Códigos exigidos para ativação. Espelha o catálogo de código. */
  @Property({ type: 'json', fieldName: 'depends_on' })
  dependsOn: string[] = [];

  /** Sempre ativo, não desativável. */
  @Property({ type: 'boolean' })
  core: boolean = false;

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date();
}
