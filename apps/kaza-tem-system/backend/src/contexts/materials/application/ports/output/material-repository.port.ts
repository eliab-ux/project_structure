import { Material } from '../../../domain/entities/material.entity';
import { MaterialId } from '../../../domain/value-objects/material-id.vo';

export const MATERIAL_REPOSITORY = Symbol('MATERIAL_REPOSITORY');

export interface MaterialFilters {
  onlyActive?: boolean;
}

export interface MaterialRepositoryPort {
  save(material: Material): Promise<Material>;
  findById(id: MaterialId): Promise<Material | null>;
  findAll(filters?: MaterialFilters): Promise<Material[]>;
  delete(id: MaterialId): Promise<void>;
}
