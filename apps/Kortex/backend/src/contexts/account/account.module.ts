import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccountOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/account-orm.entity';
import { BusinessHourOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/business-hour-orm.entity';
import { AccountMapper } from '../../infrastructure/persistence/mikro-orm/mappers/account.mapper';
import { BusinessHourMapper } from '../../infrastructure/persistence/mikro-orm/mappers/business-hour.mapper';
import { MikroOrmAccountRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-account.repository';
import { MikroOrmBusinessHourRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-business-hour.repository';
import { ACCOUNT_REPOSITORY } from './application/ports/output/account-repository.port';
import { BUSINESS_HOUR_REPOSITORY } from './application/ports/output/business-hour-repository.port';
import { GetAccountSettingsUseCase } from './application/use-cases/get-account-settings/get-account-settings.use-case';
import { UpdateAccountSettingsUseCase } from './application/use-cases/update-account-settings/update-account-settings.use-case';
import { ListBusinessHoursUseCase } from './application/use-cases/list-business-hours/list-business-hours.use-case';
import { AddBusinessHourUseCase } from './application/use-cases/add-business-hour/add-business-hour.use-case';
import { RemoveBusinessHourUseCase } from './application/use-cases/remove-business-hour/remove-business-hour.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([AccountOrmEntity, BusinessHourOrmEntity])],
  providers: [
    AccountMapper,
    BusinessHourMapper,
    { provide: ACCOUNT_REPOSITORY, useClass: MikroOrmAccountRepository },
    { provide: BUSINESS_HOUR_REPOSITORY, useClass: MikroOrmBusinessHourRepository },
    GetAccountSettingsUseCase,
    UpdateAccountSettingsUseCase,
    ListBusinessHoursUseCase,
    AddBusinessHourUseCase,
    RemoveBusinessHourUseCase,
  ],
  exports: [
    GetAccountSettingsUseCase,
    UpdateAccountSettingsUseCase,
    ListBusinessHoursUseCase,
    AddBusinessHourUseCase,
    RemoveBusinessHourUseCase,
    // Exportado para o script de bootstrap criar a primeira conta.
    ACCOUNT_REPOSITORY,
    // A Fase 4 valida a reserva contra as janelas de funcionamento.
    BUSINESS_HOUR_REPOSITORY,
  ],
})
export class AccountModule {}
