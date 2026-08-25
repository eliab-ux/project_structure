import { OwnMedia } from '../../../domain/entities/own-media.entity';

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');

export interface ContentRepositoryPort {
  save(media: OwnMedia): Promise<OwnMedia>;
  findByOwnerAndIgMediaId(ownerId: string, igMediaId: string): Promise<OwnMedia | null>;
  findById(ownerId: string, id: string): Promise<OwnMedia | null>;
  listByOwner(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<{ items: OwnMedia[]; total: number }>;
  findRecentByOwner(ownerId: string, limit: number): Promise<OwnMedia[]>;
}
