import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface PacienteIdProps {
  value: string;
}

export class PacienteId extends ValueObject<PacienteIdProps> {
  private constructor(props: PacienteIdProps) {
    super(props);
  }

  static generate(): PacienteId {
    return new PacienteId({ value: randomUUID() });
  }

  static from(id: string): PacienteId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid Paciente ID');
    }
    return new PacienteId({ value: id });
  }

  get value(): string {
    return this.props.value;
  }
}
