import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidDistributionWindowException } from '../exceptions/invalid-distribution-window.exception';

/** A window shorter than this cannot hold a jittered interval, so it is a typo, not a plan. */
const MIN_WINDOW_MINUTES = 15;

/**
 * When a distribution may send (§9.1).
 *
 * The window is a hard boundary in both directions: nothing before `start`, and §9.2 says "nunca
 * ultrapassar `window_end`". That second half is what makes the window a promise the operator can
 * make to a candidate — "nothing goes out after election eve" has to be enforceable, not advisory.
 */
export class DistributionWindow extends ValueObject<{ start: Date; end: Date }> {
  private constructor(props: { start: Date; end: Date }) {
    super(props);
  }

  static create(start: Date, end: Date): DistributionWindow {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new InvalidDistributionWindowException('Datas inválidas.');
    }
    if (end.getTime() <= start.getTime()) {
      throw new InvalidDistributionWindowException('O fim da janela deve ser depois do início.');
    }
    if (end.getTime() - start.getTime() < MIN_WINDOW_MINUTES * 60_000) {
      throw new InvalidDistributionWindowException(
        `A janela deve ter pelo menos ${MIN_WINDOW_MINUTES} minutos.`,
      );
    }
    return new DistributionWindow({ start: new Date(start), end: new Date(end) });
  }

  get start(): Date {
    return new Date(this.props.start);
  }

  get end(): Date {
    return new Date(this.props.end);
  }

  get durationHours(): number {
    return (this.props.end.getTime() - this.props.start.getTime()) / 3_600_000;
  }

  contains(instant: Date): boolean {
    return (
      instant.getTime() >= this.props.start.getTime() &&
      instant.getTime() <= this.props.end.getTime()
    );
  }

  hasClosedBy(now: Date): boolean {
    return now.getTime() > this.props.end.getTime();
  }

  /** Only forwards — see `Distribution.extendWindowTo` for why shortening is refused. */
  extendedTo(newEnd: Date): DistributionWindow {
    if (newEnd.getTime() <= this.props.end.getTime()) {
      throw new InvalidDistributionWindowException(
        'A janela só pode ser estendida para frente: encurtar deixaria envios já agendados órfãos.',
      );
    }
    return DistributionWindow.create(this.props.start, newEnd);
  }
}
