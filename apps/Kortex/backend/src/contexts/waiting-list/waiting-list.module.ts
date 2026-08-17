import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WaitingListEntryOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/waiting-list-entry-orm.entity';
import { SlotNoticeOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/slot-notice-orm.entity';
import {
  SlotNoticeMapper,
  WaitingListMapper,
} from '../../infrastructure/persistence/mikro-orm/mappers/waiting-list.mapper';
import {
  MikroOrmSlotNoticeRepository,
  MikroOrmWaitingListRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-waiting-list.repository';
import { PreOrderModule } from '../pre-order/pre-order.module';
import {
  SLOT_NOTICE_REPOSITORY,
  WAITING_LIST_REPOSITORY,
} from './application/ports/output/waiting-list-repository.port';
import {
  SlotNoticeUseCases,
  WaitingListUseCases,
} from './application/use-cases/waiting-list.use-cases';

@Module({
  imports: [
    MikroOrmModule.forFeature([WaitingListEntryOrmEntity, SlotNoticeOrmEntity]),
    // Pelo ReferenceResolver.
    PreOrderModule,
  ],
  providers: [
    WaitingListMapper,
    SlotNoticeMapper,
    { provide: WAITING_LIST_REPOSITORY, useClass: MikroOrmWaitingListRepository },
    { provide: SLOT_NOTICE_REPOSITORY, useClass: MikroOrmSlotNoticeRepository },
    WaitingListUseCases,
    SlotNoticeUseCases,
  ],
  exports: [WaitingListUseCases, SlotNoticeUseCases],
})
export class WaitingListModule {}
