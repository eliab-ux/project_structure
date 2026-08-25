import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  MATERIAL_REPOSITORY,
  MaterialRepositoryPort,
} from '../../ports/output/material-repository.port';
import { MaterialDto } from '../../dto/material.dto';
import { ListMaterialsQuery } from './list-materials.query';

@Injectable()
export class ListMaterialsUseCase implements UseCase<ListMaterialsQuery, MaterialDto[]> {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepository: MaterialRepositoryPort,
  ) {}

  async execute(query: ListMaterialsQuery): Promise<MaterialDto[]> {
    const materials = await this.materialRepository.findAll({
      onlyActive: query.onlyActive,
    });
    return materials.map(MaterialDto.fromDomain);
  }
}
