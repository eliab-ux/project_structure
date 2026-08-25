import { WhatsappInstance } from '../../../domain/entities/whatsapp-instance.entity';

export const WHATSAPP_INSTANCE_REPOSITORY = Symbol('WHATSAPP_INSTANCE_REPOSITORY');

export interface WhatsappInstanceRepositoryPort {
  save(instance: WhatsappInstance): Promise<WhatsappInstance>;
  findByUserId(userId: string): Promise<WhatsappInstance | null>;
  findByInstanceName(instanceName: string): Promise<WhatsappInstance | null>;
  delete(instance: WhatsappInstance): Promise<void>;
}
