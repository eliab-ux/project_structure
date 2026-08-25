import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MaterialOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/material-orm.entity';
import { MaterialMapper } from '../../infrastructure/persistence/mikro-orm/mappers/material.mapper';
import { MATERIAL_REPOSITORY } from './application/ports/output/material-repository.port';
import { MikroOrmMaterialRepository } from '../../infrastructure/persistence/mikro-orm/repositories/material.repository';
import { CreateMaterialUseCase } from './application/use-cases/create-material/create-material.use-case';
import { ListMaterialsUseCase } from './application/use-cases/list-materials/list-materials.use-case';
import { DeleteMaterialUseCase } from './application/use-cases/delete-material/delete-material.use-case';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [MikroOrmModule.forFeature([MaterialOrmEntity]), StorageModule],
  providers: [
    MaterialMapper,
    {
      provide: MATERIAL_REPOSITORY,
      useClass: MikroOrmMaterialRepository,
    },
    CreateMaterialUseCase,
    ListMaterialsUseCase,
    DeleteMaterialUseCase,
  ],
  exports: [CreateMaterialUseCase, ListMaterialsUseCase, DeleteMaterialUseCase],
})
export class MaterialsModule {}
