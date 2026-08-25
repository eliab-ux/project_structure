import { ChannelStatus } from '../../../domain/value-objects/channel-status.vo';

export class ListChannelsQuery {
  constructor(
    public readonly accountId: string,
    public readonly status?: ChannelStatus,
  ) {}
}
