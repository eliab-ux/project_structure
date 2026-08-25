import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface PsicologoIdProps {
  value: string;
}

export class PsicologoId extends ValueObject<PsicologoIdProps> {
  private constructor(props: PsicologoIdProps) {
    super(props);
  }

  static generate(): PsicologoId {
    return new PsicologoId({ value: randomUUID() });
  }

  static from(id: string): PsicologoId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid Psicologo ID');
    }
    return new PsicologoId({ value: id });
  }

  get value(): string {
    return this.props.value;
  }
}
