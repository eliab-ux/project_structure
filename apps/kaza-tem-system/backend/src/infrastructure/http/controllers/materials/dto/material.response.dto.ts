import { MaterialDto } from '@contexts/materials/application/dto/material.dto';

export class MaterialResponseDto {
  id!: string;
  title!: string;
  description!: string;
  type!: string;
  fileUrl!: string;
  thumbnailUrl!: string | null;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDto(dto: MaterialDto): MaterialResponseDto {
    const response = new MaterialResponseDto();
    response.id = dto.id;
    response.title = dto.title;
    response.description = dto.description;
    response.type = dto.type;
    response.fileUrl = dto.fileUrl;
    response.thumbnailUrl = dto.thumbnailUrl;
    response.isActive = dto.isActive;
    response.createdAt = dto.createdAt;
    response.updatedAt = dto.updatedAt;
    return response;
  }
}
