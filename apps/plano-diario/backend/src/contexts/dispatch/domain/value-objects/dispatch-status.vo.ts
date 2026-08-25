import { ValueObject } from '@gitspread/domain-primitives';
import { DomainException } from '@gitspread/domain-primitives';

export type DispatchStatusValue = 'pending' | 'sent' | 'failed' | 'skipped';
export type DispatchTriggerValue = 'scheduled' | 'manual';

class InvalidDispatchStatusException extends DomainException {
  constructor(value: string) {
    super(`Status de envio inválido: ${value}`);
  }
}

const STATUSES: DispatchStatusValue[] = ['pending', 'sent', 'failed', 'skipped'];

export class DispatchStatus extends ValueObject<{ value: DispatchStatusValue }> {
  static readonly PENDING = new DispatchStatus({ value: 'pending' });
  static readonly SENT = new DispatchStatus({ value: 'sent' });
  static readonly FAILED = new DispatchStatus({ value: 'failed' });
  /** Fora da janela de catch-up: não faz sentido mandar a leitura do dia às 23h. */
  static readonly SKIPPED = new DispatchStatus({ value: 'skipped' });

  private constructor(props: { value: DispatchStatusValue }) {
    super(props);
  }

  static from(value: string): DispatchStatus {
    const found = STATUSES.find((s) => s === value);
    if (!found) {
      throw new InvalidDispatchStatusException(value);
    }
    return new DispatchStatus({ value: found });
  }

  get value(): DispatchStatusValue {
    return this.props.value;
  }
  get isSent(): boolean {
    return this.props.value === 'sent';
  }
}
