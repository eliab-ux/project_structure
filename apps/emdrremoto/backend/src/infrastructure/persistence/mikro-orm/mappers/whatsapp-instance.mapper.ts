import { Injectable } from '@nestjs/common';
import {
  WhatsappInstance,
  WhatsappMode,
} from '../../../../contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { WhatsappInstanceOrmEntity } from '../entities/whatsapp-instance-orm.entity';

@Injectable()
export class WhatsappInstanceMapper {
  toDomain(orm: WhatsappInstanceOrmEntity): WhatsappInstance {
    return WhatsappInstance.reconstitute(
      orm.psicologoId,
      orm.mode as WhatsappMode,
      orm.instanceName,
      orm.apiKey,
      orm.connected,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: WhatsappInstance, existing?: WhatsappInstanceOrmEntity): WhatsappInstanceOrmEntity {
    const orm = existing ?? new WhatsappInstanceOrmEntity();
    orm.psicologoId = domain.psicologoId;
    orm.mode = domain.mode;
    orm.instanceName = domain.instanceName;
    orm.apiKey = domain.apiKey;
    orm.connected = domain.connected;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
