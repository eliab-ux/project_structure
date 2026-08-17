import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CutOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/cut-orm.entity';
import { CutMapper } from '../../infrastructure/persistence/mikro-orm/mappers/cut.mapper';
import { MikroOrmCutRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-cut.repository';
import { ScheduleModule } from '../schedule/schedule.module';
import { PreOrderModule } from '../pre-order/pre-order.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CUT_REPOSITORY } from './application/ports/output/cut-repository.port';
import { CutUseCases } from './application/use-cases/cut.use-cases';

@Module({
  imports: [
    MikroOrmModule.forFeature([CutOrmEntity]),
    // RESERVATION_REPOSITORY (estado da reserva), PRE_ORDER_REPOSITORY (tecido/produto herdados),
    // FABRIC_REPOSITORY (altura máxima) e o ReferenceResolver (nomes).
    ScheduleModule,
    PreOrderModule,
    CatalogModule,
  ],
  providers: [CutMapper, { provide: CUT_REPOSITORY, useClass: MikroOrmCutRepository }, CutUseCases],
  exports: [CutUseCases],
})
export class CutModule {}
