import { GatewayConnectionState } from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';

export class ApplyConnectionUpdateCommand {
  constructor(
    /** Parsed out of the namespaced instance name, never taken from the payload body. */
    public readonly accountId: string,
    public readonly channelId: ChannelId,
    public readonly instanceName: string,
    public readonly state: GatewayConnectionState,
    public readonly reason: string | null,
  ) {}
}
