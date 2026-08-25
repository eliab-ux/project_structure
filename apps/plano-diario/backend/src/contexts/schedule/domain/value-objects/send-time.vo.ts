import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidSendTimeException } from '../exceptions/invalid-send-time.exception';

interface Props {
  hour: number;
  minute: number;
}

/**
 * Hora local do envio, `HH:mm`. Guardada como hora e minuto separados porque o scheduler
 * compara minuto a minuto — comparar strings formatadas convidaria a erro de zero à esquerda.
 */
export class SendTime extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static create(value: string): SendTime {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((value ?? '').trim());
    if (!match) {
      throw new InvalidSendTimeException();
    }
    return new SendTime({ hour: Number(match[1]), minute: Number(match[2]) });
  }

  get hour(): number {
    return this.props.hour;
  }
  get minute(): number {
    return this.props.minute;
  }

  /** `07:00` — sempre com dois dígitos. */
  get value(): string {
    return `${String(this.props.hour).padStart(2, '0')}:${String(this.props.minute).padStart(2, '0')}`;
  }

  /** Minutos desde a meia-noite: torna a janela de catch-up uma subtração simples. */
  get minutesOfDay(): number {
    return this.props.hour * 60 + this.props.minute;
  }
}
