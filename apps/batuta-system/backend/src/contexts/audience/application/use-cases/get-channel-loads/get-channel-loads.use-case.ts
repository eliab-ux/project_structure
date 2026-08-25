import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { acceptsNewContacts } from '../../../../channel/domain/value-objects/channel-status.vo';
import { ChannelLoadDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { GetChannelLoadsQuery } from './get-channel-loads.query';

/**
 * "Carga por canal" (FASE 10, screen 4). Also the number that makes the greedy allocation legible:
 * an operator who sees one chip at 0 and three at 100 understands why the next import all goes to the
 * new one — that is the rule of §6.2 working, not a bug.
 */
@Injectable()
export class GetChannelLoadsUseCase implements UseCase<GetChannelLoadsQuery, ChannelLoadDto[]> {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
  ) {}

  async execute(_query: GetChannelLoadsQuery): Promise<ChannelLoadDto[]> {
    const [channels, counts] = await Promise.all([
      this.channels.listByAccount(),
      this.contacts.countByChannel(),
    ]);
    const loadByChannel = new Map(counts.map((count) => [count.channelId, count.contacts]));

    return channels.map((channel) => {
      const dto = new ChannelLoadDto();
      dto.channelId = channel.id.value;
      dto.channelLabel = channel.label;
      dto.channelStatus = channel.status;
      dto.acceptsNewContacts = acceptsNewContacts(channel.status);
      dto.contacts = loadByChannel.get(channel.id.value) ?? 0;
      return dto;
    });
  }
}
