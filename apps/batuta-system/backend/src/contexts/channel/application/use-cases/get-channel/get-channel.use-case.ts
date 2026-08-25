import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { GetChannelQuery } from './get-channel.query';

@Injectable()
export class GetChannelUseCase implements UseCase<GetChannelQuery, ChannelDto> {
  constructor(@Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort) {}

  async execute(query: GetChannelQuery): Promise<ChannelDto> {
    // A channel of another account resolves to null, so the caller gets 404 and never a 403 that
    // would confirm the id exists elsewhere.
    const channel = await this.channels.findById(ChannelId.from(query.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }
    return ChannelDto.fromDomain(channel);
  }
}
