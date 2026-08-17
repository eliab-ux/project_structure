import { Module } from '@nestjs/common';
import { AuthModule } from '../../contexts/auth/auth.module';
import { AccountModule } from '../../contexts/account/account.module';
import { MachineModule } from '../../contexts/machine/machine.module';
import { UserModule } from '../../contexts/user/user.module';
import { CustomerModule } from '../../contexts/customer/customer.module';
import { CatalogModule } from '../../contexts/catalog/catalog.module';
import { HealthController } from './controllers/health/health.controller';
import { AuthController } from './controllers/auth/auth.controller';
import { AccountController } from './controllers/account/account.controller';
import { MachineController } from './controllers/machine/machine.controller';
import { UserController } from './controllers/user/user.controller';
import {
  CustomerController,
  ModelistaCustomerController,
} from './controllers/customer/customer.controller';
import { FabricController, ProductTypeController } from './controllers/catalog/catalog.controller';
import { PreOrderModule } from '../../contexts/pre-order/pre-order.module';
import { WaitingListModule } from '../../contexts/waiting-list/waiting-list.module';
import {
  PreOrderController,
  SlotNoticeController,
  WaitingListController,
} from './controllers/pre-order/pre-order.controller';
import { ScheduleModule } from '../../contexts/schedule/schedule.module';
import {
  ModelistaReservationController,
  ReservationController,
  ScheduleController,
} from './controllers/schedule/schedule.controller';
import { CutModule } from '../../contexts/cut/cut.module';
import {
  CutController,
  CutStopController,
  FabricHistoryController,
} from './controllers/cut/cut.controller';
import { FinanceModule } from '../../contexts/finance/finance.module';
import {
  BankAccountController,
  CashEntryController,
  FinanceReportController,
  FinancialCategoryController,
} from './controllers/finance/finance.controller';

/**
 * Adapter HTTP de entrada. Controllers são finos: validam (DTO), chamam o Use Case, mapeiam para
 * ResponseDto. Nenhuma regra de negócio aqui.
 *
 * Rotas públicas e por quê, todas elas: `/health` (probe de liveness), `/auth/login`,
 * `/auth/refresh`, `/auth/request-password-reset` e `/auth/reset-password` — cada uma é um ponto
 * em que o chamador ainda não pode estar autenticado. Toda outra rota carrega `JwtAuthGuard`,
 * `AdminGuard` ou `OwnerGuard`.
 */
@Module({
  imports: [
    AuthModule,
    AccountModule,
    MachineModule,
    UserModule,
    CustomerModule,
    CatalogModule,
    PreOrderModule,
    WaitingListModule,
    ScheduleModule,
    CutModule,
    FinanceModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    AccountController,
    MachineController,
    UserController,
    CustomerController,
    ModelistaCustomerController,
    FabricController,
    ProductTypeController,
    PreOrderController,
    WaitingListController,
    SlotNoticeController,
    ScheduleController,
    ReservationController,
    ModelistaReservationController,
    CutController,
    CutStopController,
    FabricHistoryController,
    BankAccountController,
    FinancialCategoryController,
    CashEntryController,
    FinanceReportController,
  ],
})
export class HttpModule {}
