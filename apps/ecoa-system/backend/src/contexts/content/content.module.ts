import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OwnMediaOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/own-media-orm.entity';
import { OwnMediaMapper } from '../../infrastructure/persistence/mikro-orm/mappers/own-media.mapper';
import { MikroOrmContentRepository } from '../../infrastructure/persistence/mikro-orm/repositories/content.repository';
import { CONTENT_REPOSITORY } from './application/ports/output/content-repository.port';
import { SyncOwnMediaUseCase } from './application/use-cases/sync-own-media/sync-own-media.use-case';
import { ListOwnMediaUseCase } from './application/use-cases/list-own-media/list-own-media.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([OwnMediaOrmEntity])],
  providers: [
    OwnMediaMapper,
    { provide: CONTENT_REPOSITORY, useClass: MikroOrmContentRepository },
    SyncOwnMediaUseCase,
    ListOwnMediaUseCase,
  ],
  exports: [CONTENT_REPOSITORY, SyncOwnMediaUseCase, ListOwnMediaUseCase],
})
export class ContentModule {}
