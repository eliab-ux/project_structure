import { FieldConfig } from '../../../domain/entities/field-config.entity';

export const FIELD_CONFIG_REPOSITORY = Symbol('FIELD_CONFIG_REPOSITORY');

export interface FieldConfigRepositoryPort {
  /** Configs de uma entidade, no escopo da conta (filtro global + RLS fazem o escopo). */
  findByEntity(entity: string): Promise<FieldConfig[]>;

  /** Todas as configs da conta — a tela de configuração as agrupa por entidade. */
  findAll(): Promise<FieldConfig[]>;

  /**
   * Substitui o conjunto de configs de UMA entidade pelo conjunto informado.
   *
   * Semântica de substituição, igual à sincronização de coleções de Contato/Produto: as linhas
   * atuais da entidade saem por **soft-delete** (o papel de runtime não tem DELETE — invariante do
   * `verify:isolation`), as novas entram. A tela manda o conjunto inteiro que o usuário vê.
   */
  replaceEntityConfigs(entity: string, configs: readonly FieldConfig[]): Promise<void>;
}
