import { WhatsappInstance, WhatsappMode } from '../../domain/entities/whatsapp-instance.entity';

/**
 * Estado do WhatsApp do psicólogo. NUNCA expõe a apiKey da instância (credencial).
 */
export class WhatsappStatusDto {
  configured!: boolean;
  mode!: WhatsappMode | null;
  connected!: boolean;
  qrBase64!: string | null;
  canCreateOwn!: boolean;
  hasShared!: boolean;

  static from(params: {
    instance: WhatsappInstance | null;
    connected?: boolean;
    qrBase64?: string | null;
    canCreateOwn: boolean;
    hasShared: boolean;
  }): WhatsappStatusDto {
    const dto = new WhatsappStatusDto();
    dto.configured = !!params.instance;
    dto.mode = params.instance?.mode ?? null;
    dto.connected = params.connected ?? params.instance?.connected ?? false;
    dto.qrBase64 = params.qrBase64 ?? null;
    dto.canCreateOwn = params.canCreateOwn;
    dto.hasShared = params.hasShared;
    return dto;
  }
}
