import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  MATERIAL_REPOSITORY,
  MaterialRepositoryPort,
} from '../../ports/output/material-repository.port';
import { DeleteMaterialCommand } from './delete-material.command';
import { MaterialId } from '../../../domain/value-objects/material-id.vo';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '@infrastructure/persistence/ports/unit-of-work.port';
import { MaterialNotFoundException } from '../../../domain/exceptions/material-not-found.exception';

@Injectable()
export class DeleteMaterialUseCase implements UseCase<DeleteMaterialCommand, void> {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepository: MaterialRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: DeleteMaterialCommand): Promise<void> {
    const materialId = MaterialId.from(command.materialId);
    const material = await this.materialRepository.findById(materialId);

    if (!material) {
      throw new MaterialNotFoundException(`Material não encontrado: ${command.materialId}`);
    }

    await this.unitOfWork.execute(async () => {
      await this.materialRepository.delete(materialId);
    });
  }
}
