import { PromissoryNote } from '../../../domain/entities/promissory-note.entity';

export const PROMISSORY_NOTE_REPOSITORY = Symbol('PROMISSORY_NOTE_REPOSITORY');

export interface PromissoryNoteRepositoryPort {
  findByOrder(orderId: string): Promise<PromissoryNote | null>;
  save(note: PromissoryNote): Promise<PromissoryNote>;
}
