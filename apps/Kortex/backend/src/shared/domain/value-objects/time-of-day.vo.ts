import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../exceptions/invalid-value.exception';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface TimeOfDayProps {
  minutes: number;
}

/**
 * Hora do dia sem data, para as janelas de funcionamento (spec §4.1.1). Guardado como minutos
 * desde a meia-noite porque é isso que a comparação precisa — comparar `'09:00' < '11:30'` como
 * string funciona por acidente do formato e quebra no primeiro `'9:00'` sem zero à esquerda.
 *
 * Aceita `HH:MM` e o `HH:MM:SS` que o driver do Postgres devolve para colunas `time`.
 */
export class TimeOfDay extends ValueObject<TimeOfDayProps> {
  private constructor(props: TimeOfDayProps) {
    super(props);
  }

  static create(raw: string): TimeOfDay {
    const value = (raw ?? '').trim();
    // O Postgres devolve 'HH:MM:SS'; os segundos são sempre 00 numa janela e são descartados.
    const normalized = value.length === 8 && value.endsWith(':00') ? value.slice(0, 5) : value;

    const match = HH_MM.exec(normalized);
    if (!match) {
      throw new InvalidValueException('Horário inválido. Use o formato HH:MM (ex.: 07:00).');
    }

    return new TimeOfDay({ minutes: Number(match[1]) * 60 + Number(match[2]) });
  }

  static fromMinutes(minutes: number): TimeOfDay {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 23 * 60 + 59) {
      throw new InvalidValueException('Horário inválido.');
    }
    return new TimeOfDay({ minutes });
  }

  get minutes(): number {
    return this.props.minutes;
  }

  isBefore(other: TimeOfDay): boolean {
    return this.props.minutes < other.props.minutes;
  }

  /** 'HH:MM' — o formato da UI e o que o Postgres aceita numa coluna `time`. */
  get value(): string {
    const hours = Math.floor(this.props.minutes / 60);
    const minutes = this.props.minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  toString(): string {
    return this.value;
  }
}
