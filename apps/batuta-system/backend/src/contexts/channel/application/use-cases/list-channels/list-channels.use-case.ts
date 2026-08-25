import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { ListChannelsQuery } from './list-channels.query';

/**
 * Channels of the current account. The repository takes no accountId: the global tenant filter
 * scopes it from the request JWT, which is the point of the mechanical isolation.
 */
@Injectable()
export class ListChannelsUseCase implements UseCase<ListChannelsQuery, ChannelDto[]> {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(query: ListChannelsQuery): Promise<ChannelDto[]> {
    const channels = await this.channels.listByAccount(query.status);
    return channels.map((channel) => ChannelDto.fromDomain(channel));
  }
}
