import { ValueObject } from '@gitspread/domain-primitives';

export type MaterialTypeValue = 'banner' | 'post' | 'video' | 'text' | 'link';

interface MaterialTypeProps {
  value: MaterialTypeValue;
}

export class MaterialType extends ValueObject<MaterialTypeProps> {
  private constructor(props: MaterialTypeProps) {
    super(props);
  }

  static from(value: string): MaterialType {
    const normalized = (value || '').trim().toLowerCase() as MaterialTypeValue;
    if (!['banner', 'post', 'video', 'text', 'link'].includes(normalized)) {
      throw new Error(`Tipo de material inválido: ${value}`);
    }
    return new MaterialType({ value: normalized });
  }

  get value(): MaterialTypeValue {
    return this.props.value;
  }
}
