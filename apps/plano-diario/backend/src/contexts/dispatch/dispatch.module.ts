import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DispatchLogOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/dispatch-log-orm.entity';
import { DispatchLogMapper } from '../../infrastructure/persistence/mikro-orm/mappers/dispatch-log.mapper';
import { MikroOrmDispatchLogRepository } from '../../infrastructure/persistence/mikro-orm/repositories/dispatch-log.repository';
import { CatalogModule } from '../catalog/catalog.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { DISPATCH_LOG_REPOSITORY } from './application/ports/output/dispatch-log-repository.port';
import { ExecuteDispatchUseCase } from './application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { ListDispatchHistoryUseCase } from './application/use-cases/list-dispatch-history/list-dispatch-history.use-case';
import { PlanDispatchTickUseCase } from './application/use-cases/plan-dispatch-tick/plan-dispatch-tick.use-case';
import { SendNowUseCase } from './application/use-cases/send-now/send-now.use-case';

/**
 * O dispatch é o único context que orquestra os outros: pede o vídeo ao `catalog`, a
 * configuração ao `schedule` e o envio ao `whatsapp`.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([DispatchLogOrmEntity]),
    CatalogModule,
    ScheduleModule,
    WhatsappModule,
  ],
  providers: [
    DispatchLogMapper,
    { provide: DISPATCH_LOG_REPOSITORY, useClass: MikroOrmDispatchLogRepository },
    ExecuteDispatchUseCase,
    PlanDispatchTickUseCase,
    SendNowUseCase,
    ListDispatchHistoryUseCase,
  ],
  exports: [
    DISPATCH_LOG_REPOSITORY,
    ExecuteDispatchUseCase,
    PlanDispatchTickUseCase,
    SendNowUseCase,
    ListDispatchHistoryUseCase,
  ],
})
export class DispatchModule {}
