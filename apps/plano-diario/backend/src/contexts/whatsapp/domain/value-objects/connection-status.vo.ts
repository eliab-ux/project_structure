import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidConnectionStatusException } from '../exceptions/invalid-connection-status.exception';

export type ConnectionStatusValue =
  | 'pending_qr'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

const VALUES: ConnectionStatusValue[] = [
  'pending_qr',
  'connecting',
  'connected',
  'disconnected',
  'error',
];

export class ConnectionStatus extends ValueObject<{ value: ConnectionStatusValue }> {
  static readonly PENDING_QR = new ConnectionStatus({ value: 'pending_qr' });
  static readonly CONNECTING = new ConnectionStatus({ value: 'connecting' });
  static readonly CONNECTED = new ConnectionStatus({ value: 'connected' });
  static readonly DISCONNECTED = new ConnectionStatus({ value: 'disconnected' });
  static readonly ERROR = new ConnectionStatus({ value: 'error' });

  private constructor(props: { value: ConnectionStatusValue }) {
    super(props);
  }

  static from(value: string): ConnectionStatus {
    const found = VALUES.find((v) => v === value);
    if (!found) {
      throw new InvalidConnectionStatusException(value);
    }
    return new ConnectionStatus({ value: found });
  }

  /**
   * Traduz o `state` da Evolution para o nosso vocabulário. Estado desconhecido vira
   * `disconnected`, nunca `connected`: na dúvida, o sistema assume que NÃO pode enviar.
   */
  static fromProviderState(state: string | undefined | null): ConnectionStatus {
    switch ((state ?? '').toLowerCase()) {
      case 'open':
        return ConnectionStatus.CONNECTED;
      case 'connecting':
        return ConnectionStatus.CONNECTING;
      case 'close':
      case 'closed':
        return ConnectionStatus.DISCONNECTED;
      default:
        return ConnectionStatus.DISCONNECTED;
    }
  }

  get value(): ConnectionStatusValue {
    return this.props.value;
  }

  get isConnected(): boolean {
    return this.props.value === 'connected';
  }
}
