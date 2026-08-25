import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../../channel/domain/entities/channel.entity';
import { ChannelId } from '../../../../channel/domain/value-objects/channel-id.vo';
import {
  acceptsNewContacts,
  allowsSenderMigration,
} from '../../../../channel/domain/value-objects/channel-status.vo';
import { ChannelNotFoundException } from '../../../../channel/domain/exceptions/channel-not-found.exception';
import { ChannelAllocator, ChannelLoad } from '../../../domain/services/channel-allocator';
import { MigrationStrategy } from '../../../domain/value-objects/migration-strategy.vo';
import { ChannelLoadDto, MigrationPreviewDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { PreviewSenderMigrationQuery } from './preview-sender-migration.query';

/**
 * The mandatory preview of §6.4 item 3: how many contacts change sender, and the load per channel
 * before and after.
 *
 * It exists because migration is irreversible in practice and unbalances silently. `ALL_TO_ONE` in
 * particular is the one the spec warns about — "simples, mas desequilibra: mostre na prévia a carga
 * resultante do destino" — so the after-picture is computed with the SAME allocator the execution
 * uses, not estimated. Preview and execution cannot disagree.
 *
 * It never throws for an ineligible source: it returns `blockedReason`, so the screen can explain why
 * the button is disabled instead of showing an error after a click.
 */
@Injectable()
export class PreviewSenderMigrationUseCase implements UseCase<
  PreviewSenderMigrationQuery,
  MigrationPreviewDto
> {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
  ) {}

  async execute(query: PreviewSenderMigrationQuery): Promise<MigrationPreviewDto> {
    const from = await this.channels.findById(ChannelId.from(query.fromChannelId));
    if (!from) {
      throw new ChannelNotFoundException();
    }

    const [allChannels, counts] = await Promise.all([
      this.channels.listByAccount(),
      this.contacts.countByChannel(),
    ]);
    const loadByChannel = new Map(counts.map((count) => [count.channelId, count.contacts]));

    const dto = new MigrationPreviewDto();
    dto.fromChannelId = from.id.value;
    dto.fromChannelLabel = from.label;
    dto.fromChannelStatus = from.status;
    dto.strategy = query.strategy;
    dto.toChannelId = query.toChannelId;
    dto.contactsToMigrate = loadByChannel.get(from.id.value) ?? 0;
    dto.loadsBefore = PreviewSenderMigrationUseCase.toLoadDtos(allChannels, loadByChannel);
    dto.blockedReason = null;

    // §6.4 item 1: only a terminal source qualifies. DISCONNECTED is transient and does not.
    if (!allowsSenderMigration(from.status)) {
      dto.blockedReason =
        `Canal em ${from.status} não habilita migração. Desconexão é transitória: religue o chip ` +
        'ou pareie novamente. A migração existe só para canal BANIDO ou APOSENTADO.';
      dto.loadsAfter = dto.loadsBefore;
      return dto;
    }

    const destinations = allChannels.filter(
      (channel) => channel.id.value !== from.id.value && acceptsNewContacts(channel.status),
    );

    if (destinations.length === 0) {
      dto.blockedReason =
        'Nenhum outro canal conectado para receber os contatos. Conecte um chip antes de migrar.';
      dto.loadsAfter = dto.loadsBefore;
      return dto;
    }

    if (query.strategy === MigrationStrategy.ALL_TO_ONE) {
      const target = destinations.find((channel) => channel.id.value === query.toChannelId);
      if (!target) {
        dto.blockedReason =
          'Canal de destino inválido: escolha um canal conectado diferente do canal de origem.';
        dto.loadsAfter = dto.loadsBefore;
        return dto;
      }
      dto.loadsAfter = PreviewSenderMigrationUseCase.toLoadDtos(
        allChannels,
        PreviewSenderMigrationUseCase.applyAllToOne(
          loadByChannel,
          from.id.value,
          target.id.value,
          dto.contactsToMigrate,
        ),
      );
      return dto;
    }

    // REDISTRIBUTE: the very allocator of §6.2, so the preview is the plan.
    const allocator = new ChannelAllocator(
      destinations.map<ChannelLoad>((channel) => ({
        channelId: channel.id.value,
        allocatedContacts: loadByChannel.get(channel.id.value) ?? 0,
        createdAt: channel.createdAt,
      })),
    );
    allocator.allocateMany(dto.contactsToMigrate);

    const after = new Map(loadByChannel);
    after.set(from.id.value, 0);
    for (const load of allocator.snapshot()) {
      after.set(load.channelId, load.allocatedContacts);
    }
    dto.loadsAfter = PreviewSenderMigrationUseCase.toLoadDtos(allChannels, after);
    return dto;
  }

  private static applyAllToOne(
    loads: ReadonlyMap<string, number>,
    fromChannelId: string,
    toChannelId: string,
    moving: number,
  ): Map<string, number> {
    const after = new Map(loads);
    after.set(fromChannelId, 0);
    after.set(toChannelId, (after.get(toChannelId) ?? 0) + moving);
    return after;
  }

  private static toLoadDtos(
    channels: readonly Channel[],
    loads: ReadonlyMap<string, number>,
  ): ChannelLoadDto[] {
    return channels.map((channel) => {
      const dto = new ChannelLoadDto();
      dto.channelId = channel.id.value;
      dto.channelLabel = channel.label;
      dto.channelStatus = channel.status;
      dto.acceptsNewContacts = acceptsNewContacts(channel.status);
      dto.contacts = loads.get(channel.id.value) ?? 0;
      return dto;
    });
  }
}
