import { Material } from '../../domain/entities/material.entity';

export class MaterialDto {
  id!: string;
  title!: string;
  description!: string;
  type!: string;
  fileUrl!: string;
  thumbnailUrl!: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(material: Material): MaterialDto {
    const dto = new MaterialDto();
    dto.id = material.id.value;
    dto.title = material.title;
    dto.description = material.description;
    dto.type = material.type.value;
    dto.fileUrl = material.fileUrl;
    dto.thumbnailUrl = material.thumbnailUrl;
    dto.isActive = material.isActive;
    dto.createdAt = material.createdAt;
    dto.updatedAt = material.updatedAt;
    return dto;
  }
}
