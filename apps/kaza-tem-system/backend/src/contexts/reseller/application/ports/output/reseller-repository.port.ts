import { Reseller } from '../../../domain/entities/reseller.entity';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { CPF } from '../../../domain/value-objects/cpf.vo';
import { UniqueLink } from '../../../domain/value-objects/unique-link.vo';

export const RESELLER_REPOSITORY = Symbol('RESELLER_REPOSITORY');

export interface ResellerRepositoryPort {
  save(reseller: Reseller): Promise<Reseller>;
  findById(id: ResellerId): Promise<Reseller | null>;
  findByUserId(userId: string): Promise<Reseller | null>;
  findByCPF(cpf: CPF): Promise<Reseller | null>;
  findByUniqueLink(link: UniqueLink): Promise<Reseller | null>;
}
