import { ValueObject } from '@gitspread/domain-primitives';

export type ConnectionStatusValue = 'connected' | 'expired' | 'revoked';

export class ConnectionStatus extends ValueObject<{ value: ConnectionStatusValue }> {
  static readonly CONNECTED = new ConnectionStatus({ value: 'connected' });
  static readonly EXPIRED = new ConnectionStatus({ value: 'expired' });
  static readonly REVOKED = new ConnectionStatus({ value: 'revoked' });

  private constructor(props: { value: ConnectionStatusValue }) {
    super(props);
  }

  get value(): ConnectionStatusValue {
    return this.props.value;
  }

  get isConnected(): boolean {
    return this.props.value === 'connected';
  }

  static from(value: string | null | undefined): ConnectionStatus {
    switch ((value ?? '').toLowerCase()) {
      case 'connected':
        return ConnectionStatus.CONNECTED;
      case 'expired':
        return ConnectionStatus.EXPIRED;
      case 'revoked':
        return ConnectionStatus.REVOKED;
      default:
        throw new Error(`Invalid connection status: ${value}`);
    }
  }
}
