import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScheduleOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/schedule-orm.entity';
import { ScheduleMapper } from '../../infrastructure/persistence/mikro-orm/mappers/schedule.mapper';
import { MikroOrmScheduleRepository } from '../../infrastructure/persistence/mikro-orm/repositories/schedule.repository';
import { WhatsappGroupDirectoryAdapter } from '../../infrastructure/whatsapp/group-directory.adapter';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { GROUP_DIRECTORY } from './application/ports/output/group-directory.port';
import { SCHEDULE_REPOSITORY } from './application/ports/output/schedule-repository.port';
import { GetScheduleUseCase } from './application/use-cases/get-schedule/get-schedule.use-case';
import { ToggleScheduleUseCase } from './application/use-cases/toggle-schedule/toggle-schedule.use-case';
import { UpsertScheduleUseCase } from './application/use-cases/upsert-schedule/upsert-schedule.use-case';

@Module({
  // WhatsappModule entra só para o adapter do GROUP_DIRECTORY encontrar o repositório de grupos.
  imports: [MikroOrmModule.forFeature([ScheduleOrmEntity]), WhatsappModule],
  providers: [
    ScheduleMapper,
    { provide: SCHEDULE_REPOSITORY, useClass: MikroOrmScheduleRepository },
    { provide: GROUP_DIRECTORY, useClass: WhatsappGroupDirectoryAdapter },
    GetScheduleUseCase,
    UpsertScheduleUseCase,
    ToggleScheduleUseCase,
  ],
  exports: [SCHEDULE_REPOSITORY, GetScheduleUseCase, UpsertScheduleUseCase, ToggleScheduleUseCase],
})
export class ScheduleModule {}
