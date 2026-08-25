import { WhatsappGroup } from '../../../domain/entities/whatsapp-group.entity';

export const WHATSAPP_GROUP_REPOSITORY = Symbol('WHATSAPP_GROUP_REPOSITORY');

export interface WhatsappGroupRepositoryPort {
  findAllByUserId(userId: string): Promise<WhatsappGroup[]>;
  findByUserAndJid(userId: string, jid: string): Promise<WhatsappGroup | null>;
  /** Grava os grupos atuais e remove do cache os que não vieram mais (o usuário saiu deles). */
  replaceAllForUser(userId: string, groups: WhatsappGroup[]): Promise<void>;
}
