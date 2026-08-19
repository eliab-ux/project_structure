import { DomainException, ValueObject } from '@gitspread/domain-primitives';

export class InvalidAccessWindowException extends DomainException {}

export interface AccessWindowProps {
  /** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
  weekday: number;
  /** Minutes from midnight, so a window is two integers and comparisons are trivial. */
  startMinute: number;
  endMinute: number;
}

/**
 * A permitted login window for a user (01_Veertex_Core §3.3, referência Bling).
 *
 * ⚠️ **Modelled in F1, NOT enforced in F1** — 01 §3.3 and §8 put the UI in phase 2, and the doc asks
 * for "o modelo preparado". The column exists and this value object validates whatever lands in it,
 * so the eventual check is a use-case change and not a migration.
 *
 * Deliberately NOT wired into the login flow yet: enforcing a rule whose UI does not exist would
 * lock people out of accounts with no way to see or fix the window that did it.
 */
export class AccessWindow extends ValueObject<AccessWindowProps> {
  private constructor(props: AccessWindowProps) {
    super(props);
  }

  static create(input: { weekday: number; startMinute: number; endMinute: number }): AccessWindow {
    const { weekday, startMinute, endMinute } = input;

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new InvalidAccessWindowException('Dia da semana deve estar entre 0 (dom) e 6 (sáb).');
    }
    for (const [label, minute] of [
      ['início', startMinute],
      ['fim', endMinute],
    ] as [string, number][]) {
      if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
        throw new InvalidAccessWindowException(`Horário de ${label} inválido.`);
      }
    }
    if (endMinute <= startMinute) {
      // A window that ends before it starts would silently deny every login on that weekday.
      throw new InvalidAccessWindowException('O horário final deve ser maior que o inicial.');
    }

    return new AccessWindow({ weekday, startMinute, endMinute });
  }

  get weekday(): number {
    return this.props.weekday;
  }

  get startMinute(): number {
    return this.props.startMinute;
  }

  get endMinute(): number {
    return this.props.endMinute;
  }

  contains(moment: { weekday: number; minute: number }): boolean {
    return (
      moment.weekday === this.props.weekday &&
      moment.minute >= this.props.startMinute &&
      moment.minute < this.props.endMinute
    );
  }

  toJSON(): AccessWindowProps {
    return { ...this.props };
  }
}
