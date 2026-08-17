import { randomUUID } from 'node:crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

interface UuidIdProps {
  value: string;
}

/**
 * Base dos identificadores. Tipar o id impede a troca silenciosa que o `string` permite —
 * `findById(machineId)` num repositório de usuário compila alegremente com strings e falha em
 * produção devolvendo `null` como se o registro não existisse.
 */
export abstract class UuidId extends ValueObject<UuidIdProps> {
  protected constructor(props: UuidIdProps) {
    super(props);
  }

  protected static parse(value: string, label: string): UuidIdProps {
    const trimmed = (value ?? '').trim();
    if (!ValidationUtil.isUUID(trimmed)) {
      throw new InvalidValueException(`${label} inválido.`);
    }
    return { value: trimmed.toLowerCase() };
  }

  protected static generate(): UuidIdProps {
    return { value: randomUUID() };
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
