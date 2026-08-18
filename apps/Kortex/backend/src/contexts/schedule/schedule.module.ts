import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScheduleEntryOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/schedule-entry-orm.entity';
import { ReservationOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/reservation-orm.entity';
import {
  ReservationMapper,
  ScheduleEntryMapper,
} from '../../infrastructure/persistence/mikro-orm/mappers/schedule.mapper';
import {
  MikroOrmReservationRepository,
  MikroOrmScheduleEntryRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-schedule.repository';
import { AccountModule } from '../account/account.module';
import { MachineModule } from '../machine/machine.module';
import { PreOrderModule } from '../pre-order/pre-order.module';
import { FinanceModule } from '../finance/finance.module';
import {
  RESERVATION_REPOSITORY,
  SCHEDULE_ENTRY_REPOSITORY,
} from './application/ports/output/schedule-repository.port';
import { ScheduleUseCases } from './application/use-cases/schedule.use-cases';

@Module({
  imports: [
    MikroOrmModule.forFeature([ScheduleEntryOrmEntity, ReservationOrmEntity]),
    // ACCOUNT_REPOSITORY (fuso da conta), BUSINESS_HOUR_REPOSITORY (janelas),
    // MACHINE_REPOSITORY (preço da máquina), PRE_ORDER_REPOSITORY + ReferenceResolver (nomes).
    AccountModule,
    MachineModule,
    PreOrderModule,
    // CASH_RECORDER — o pagamento vira entrada de caixa no mesmo ato (§4.15).
    FinanceModule,
  ],
  providers: [
    ScheduleEntryMapper,
    ReservationMapper,
    { provide: SCHEDULE_ENTRY_REPOSITORY, useClass: MikroOrmScheduleEntryRepository },
    { provide: RESERVATION_REPOSITORY, useClass: MikroOrmReservationRepository },
    ScheduleUseCases,
  ],
  // RESERVATION_REPOSITORY sai para a Fase 5: o apontamento lê e move o estado da reserva.
  exports: [ScheduleUseCases, RESERVATION_REPOSITORY],
})
export class ScheduleModule {}
