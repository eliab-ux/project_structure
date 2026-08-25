import { WhatsappInstance } from '../../domain/entities/whatsapp-instance.entity';

/**
 * Visão da instância no limite da aplicação. O `token` está ausente de propósito — ele nunca
 * sai do backend, nem para o próprio dono da conta.
 */
export class WhatsappInstanceDto {
  status!: string;
  connectedNumber!: string | null;
  lastStatusAt!: Date;
  createdAt!: Date;

  static fromDomain(instance: WhatsappInstance): WhatsappInstanceDto {
    const dto = new WhatsappInstanceDto();
    dto.status = instance.status.value;
    dto.connectedNumber = instance.connectedNumber;
    dto.lastStatusAt = instance.lastStatusAt;
    dto.createdAt = instance.createdAt;
    // instanceName e token nunca são mapeados — ausência intencional.
    return dto;
  }
}

export class QrCodeDto {
  status!: string;
  qrCodeBase64?: string;
  pairingCode?: string;
  /** O QR da Evolution expira em ~60s; a tela usa isso para oferecer "Gerar novo QR". */
  expiresInSeconds!: number;

  static from(params: {
    status: string;
    qrCodeBase64?: string;
    pairingCode?: string;
    expiresInSeconds?: number;
  }): QrCodeDto {
    const dto = new QrCodeDto();
    dto.status = params.status;
    dto.qrCodeBase64 = params.qrCodeBase64;
    dto.pairingCode = params.pairingCode;
    dto.expiresInSeconds = params.expiresInSeconds ?? 60;
    return dto;
  }
}
