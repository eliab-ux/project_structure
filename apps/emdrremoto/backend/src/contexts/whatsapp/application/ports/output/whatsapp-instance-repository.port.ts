import { WhatsappInstance } from '../../../domain/entities/whatsapp-instance.entity';

export const WHATSAPP_INSTANCE_REPOSITORY = Symbol('WHATSAPP_INSTANCE_REPOSITORY');

export interface WhatsappInstanceRepositoryPort {
  findByPsicologo(psicologoId: string): Promise<WhatsappInstance | null>;
  save(instance: WhatsappInstance): Promise<WhatsappInstance>;
  delete(psicologoId: string): Promise<void>;
}
