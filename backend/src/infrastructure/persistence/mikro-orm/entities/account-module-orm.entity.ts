import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * A ativação de um módulo por uma conta — tenant-scoped, com RLS como qualquer tabela de negócio.
 *
 * A chave é o CÓDIGO do módulo, não o id da linha em `modules`: o código é estável, legível em
 * consulta de suporte, e evita um join em toda leitura de "quais módulos esta conta tem" — que é
 * uma leitura de caminho quente, feita a cada login e a cada refresh.
 */
@Entity({ tableName: 'account_modules' })
@Unique({ properties: ['accountId', 'moduleCode'] })
export class AccountModuleOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ length: 20, fieldName: 'module_code' })
  moduleCode!: string;

  @Index()
  @Property({ type: 'boolean' })
  active: boolean = true;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'activated_at' })
  activatedAt: Date | null = null;

  /**
   * Quando foi desligado. Preservado junto com `activated_at` porque desativação não apaga nada
   * (01_Veertex_Core §3.7) e a trilha de quando o módulo esteve no ar é o que explica um relatório
   * com buraco no meio.
   */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'deactivated_at' })
  deactivatedAt: Date | null = null;
}
