import { Injectable } from '@nestjs/common';
import { WhatsappGroup } from '../../../../contexts/whatsapp/domain/entities/whatsapp-group.entity';
import { GroupJid } from '../../../../contexts/whatsapp/domain/value-objects/group-jid.vo';
import { WhatsappGroupOrmEntity } from '../entities/whatsapp-group-orm.entity';

@Injectable()
export class WhatsappGroupMapper {
  toDomain(orm: WhatsappGroupOrmEntity): WhatsappGroup {
    return WhatsappGroup.reconstitute({
      id: orm.id,
      userId: orm.userId,
      instanceId: orm.instanceId,
      jid: GroupJid.create(orm.groupJid),
      name: orm.name,
      participantsCount: orm.participantsCount ?? null,
      syncedAt: orm.syncedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: WhatsappGroup, existing?: WhatsappGroupOrmEntity): WhatsappGroupOrmEntity {
    const orm = existing ?? new WhatsappGroupOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.instanceId = domain.instanceId;
    orm.groupJid = domain.jid.value;
    orm.name = domain.name;
    orm.participantsCount = domain.participantsCount;
    orm.syncedAt = domain.syncedAt;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
