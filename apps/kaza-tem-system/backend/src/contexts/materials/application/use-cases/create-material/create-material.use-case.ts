import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Material } from '../../../domain/entities/material.entity';
import { MaterialType } from '../../../domain/value-objects/material-type.vo';
import {
  MATERIAL_REPOSITORY,
  MaterialRepositoryPort,
} from '../../ports/output/material-repository.port';
import { MaterialDto } from '../../dto/material.dto';
import { CreateMaterialCommand } from './create-material.command';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '@infrastructure/persistence/ports/unit-of-work.port';
import { SupabaseStorageService } from '@infrastructure/storage/supabase-storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateMaterialUseCase implements UseCase<CreateMaterialCommand, MaterialDto> {
  constructor(
    @Inject(MATERIAL_REPOSITORY)
    private readonly materialRepository: MaterialRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly storage: SupabaseStorageService,
  ) {}

  async execute(command: CreateMaterialCommand): Promise<MaterialDto> {
    const type = MaterialType.from(command.type);
    const folder = `materials/${randomUUID()}`;
    const filePath = `${folder}/${command.fileName}`;
    const fileUrl = await this.storage.uploadFile(
      'materials',
      filePath,
      command.fileBuffer,
      command.fileMimeType,
    );

    let thumbnailUrl: string | null = null;
    if (command.thumbnailBuffer && command.thumbnailName && command.thumbnailMimeType) {
      const thumbPath = `${folder}/thumb-${command.thumbnailName}`;
      thumbnailUrl = await this.storage.uploadFile(
        'materials',
        thumbPath,
        command.thumbnailBuffer,
        command.thumbnailMimeType,
      );
    }

    const material = Material.create({
      title: command.title,
      description: command.description,
      type,
      fileUrl,
      thumbnailUrl,
    });

    const saved = await this.unitOfWork.execute(async () => {
      return this.materialRepository.save(material);
    });

    return MaterialDto.fromDomain(saved);
  }
}
