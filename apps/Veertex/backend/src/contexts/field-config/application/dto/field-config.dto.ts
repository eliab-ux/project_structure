import { EffectiveField } from '../../domain/effective-field';

/** A configuração efetiva de uma entidade — catálogo mesclado com a config da conta. */
export class EntityFieldConfigDto {
  entity!: string;
  fields!: EffectiveFieldDto[];

  static from(entity: string, fields: readonly EffectiveField[]): EntityFieldConfigDto {
    const dto = new EntityFieldConfigDto();
    dto.entity = entity;
    dto.fields = fields.map(EffectiveFieldDto.from);
    return dto;
  }
}

/**
 * Um campo como a conta o vê. Mesmo formato que o `GET /contacts/field-catalog` já devolvia — daí a
 * tela não muda quando a rota passa a mesclar a config (ver docblock dos catálogos).
 */
export class EffectiveFieldDto {
  field!: string;
  label!: string;
  group!: string | null;
  visible!: boolean;
  required!: boolean;
  order!: number | null;
  /** A tela desabilita os toggles de visível/obrigatório onde isto é `true` (DECISÃO 2.1). */
  mandatoryByDomain!: boolean;
  hint?: string;
  source!: 'catalog' | 'account';

  static from(field: EffectiveField): EffectiveFieldDto {
    const dto = new EffectiveFieldDto();
    dto.field = field.field;
    dto.label = field.label;
    dto.group = field.group;
    dto.visible = field.visible;
    dto.required = field.required;
    dto.order = field.order;
    dto.mandatoryByDomain = field.mandatoryByDomain;
    dto.hint = field.hint;
    dto.source = field.source;
    return dto;
  }
}
