import { WhatsappGroup } from '../../domain/entities/whatsapp-group.entity';

export class WhatsappGroupDto {
  jid!: string;
  name!: string;
  participantsCount!: number | null;
  syncedAt!: Date;

  static fromDomain(group: WhatsappGroup): WhatsappGroupDto {
    const dto = new WhatsappGroupDto();
    dto.jid = group.jid.value;
    dto.name = group.name;
    dto.participantsCount = group.participantsCount;
    dto.syncedAt = group.syncedAt;
    return dto;
  }
}

export class GroupListDto {
  groups!: WhatsappGroupDto[];
  /** Quando o cache foi atualizado pela última vez (null = nunca sincronizou). */
  lastSyncedAt!: Date | null;
  /** `true` quando o cache passou da idade máxima e vale apertar "Atualizar grupos". */
  stale!: boolean;

  static from(groups: WhatsappGroup[], stale: boolean): GroupListDto {
    const dto = new GroupListDto();
    dto.groups = groups.map((g) => WhatsappGroupDto.fromDomain(g));
    dto.lastSyncedAt =
      groups.length > 0
        ? groups.reduce((max, g) => (g.syncedAt > max ? g.syncedAt : max), groups[0].syncedAt)
        : null;
    dto.stale = stale;
    return dto;
  }
}
