import { GroupListDto } from '../../../../../contexts/whatsapp/application/dto/whatsapp-group.dto';
import {
  QrCodeDto,
  WhatsappInstanceDto,
} from '../../../../../contexts/whatsapp/application/dto/whatsapp-instance.dto';

/** Nunca expõe `instanceName` nem o token da instância — ausência intencional. */
export class InstanceResponseDto {
  /** `null` quando o usuário nunca conectou um WhatsApp. */
  status!: string | null;
  connectedNumber!: string | null;
  lastStatusAt!: Date | null;
  connectedSince!: Date | null;

  static fromDto(instance: WhatsappInstanceDto | null): InstanceResponseDto {
    const dto = new InstanceResponseDto();
    dto.status = instance?.status ?? null;
    dto.connectedNumber = instance?.connectedNumber ?? null;
    dto.lastStatusAt = instance?.lastStatusAt ?? null;
    dto.connectedSince = instance?.createdAt ?? null;
    return dto;
  }
}

export class GroupResponseDto {
  jid!: string;
  name!: string;
  participantsCount!: number | null;
}

export class GroupListResponseDto {
  groups!: GroupResponseDto[];
  lastSyncedAt!: Date | null;
  stale!: boolean;

  static fromDto(list: GroupListDto): GroupListResponseDto {
    const dto = new GroupListResponseDto();
    dto.groups = list.groups.map((g) => ({
      jid: g.jid,
      name: g.name,
      participantsCount: g.participantsCount,
    }));
    dto.lastSyncedAt = list.lastSyncedAt;
    dto.stale = list.stale;
    return dto;
  }
}

export class QrCodeResponseDto {
  status!: string;
  qrCodeBase64?: string;
  pairingCode?: string;
  expiresInSeconds!: number;

  static fromDto(qr: QrCodeDto): QrCodeResponseDto {
    const dto = new QrCodeResponseDto();
    dto.status = qr.status;
    dto.qrCodeBase64 = qr.qrCodeBase64;
    dto.pairingCode = qr.pairingCode;
    dto.expiresInSeconds = qr.expiresInSeconds;
    return dto;
  }
}
