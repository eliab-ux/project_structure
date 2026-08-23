import { Module } from '@nestjs/common';
import { AccountModule } from '../../contexts/account/account.module';
import { AuthModule } from '../../contexts/auth/auth.module';
import { CompanyModule } from '../../contexts/company/company.module';
import { ContactModule } from '../../contexts/contact/contact.module';
import { ProductModule } from '../../contexts/product/product.module';
import { FieldConfigModule } from '../../contexts/field-config/field-config.module';
import { OrderModule } from '../../contexts/order/order.module';
import { StockModule } from '../../contexts/stock/stock.module';
import { PaymentConditionModule } from '../../contexts/payment-condition/payment-condition.module';
import { PriceListModule } from '../../contexts/price-list/price-list.module';
import { CommissionModule } from '../../contexts/commission/commission.module';
import { FinanceModule } from '../../contexts/finance/finance.module';
import { RouteModule } from '../../contexts/route/route.module';
import { ModuleModule } from '../../contexts/module/module.module';
import { PlanModule } from '../../contexts/plan/plan.module';
import { RoleModule } from '../../contexts/role/role.module';
import { UserModule } from '../../contexts/user/user.module';
import { HealthController } from './controllers/health/health.controller';
import { AuthController } from './controllers/auth/auth.controller';
import { AccountController } from './controllers/account/account.controller';
import { CompanyController } from './controllers/company/company.controller';
import { ContactController } from './controllers/contact/contact.controller';
import { ProductController } from './controllers/product/product.controller';
import { FieldConfigController } from './controllers/field-config/field-config.controller';
import { OrderController } from './controllers/order/order.controller';
import { StockController } from './controllers/stock/stock.controller';
import { PaymentConditionController } from './controllers/payment-condition/payment-condition.controller';
import { PriceListController } from './controllers/price-list/price-list.controller';
import { CommissionController } from './controllers/commission/commission.controller';
import { FinanceController } from './controllers/finance/finance.controller';
import { RouteController } from './controllers/route/route.controller';
import { ModuleController } from './controllers/module/module.controller';
import { RoleController } from './controllers/role/role.controller';
import { UserController } from './controllers/user/user.controller';
import { IntentController } from './controllers/intent/intent.controller';
import { IntentModule } from '../../contexts/intent/intent.module';

/**
 * The HTTP inbound adapter. Controllers stay thin: validate (DTO), call the use case, map to a
 * ResponseDto. No business logic here.
 *
 * **Public routes, and why — the complete list:**
 *   - `GET /health` — the container's liveness probe; a probe that needs a token cannot run;
 *   - `POST /auth/login` — where authentication begins, so it cannot require authentication;
 *   - `POST /auth/refresh` — the access token is expired by definition when this is called;
 *   - `POST /auth/request-password-reset` and `POST /auth/reset-password` — whoever forgot their
 *     password cannot log in to ask for a new one.
 *
 * Every other route in the system carries `PermissionGuard` (which extends `JwtAuthGuard`) or
 * `JwtAuthGuard`. There is no route without one and without a comment saying why.
 *
 * Onboarding (`CreateAccount`) has NO route at all — it runs under the operator scope from the
 * `create:account` CLI. See the use case's docblock.
 */
@Module({
  imports: [
    AuthModule,
    AccountModule,
    CompanyModule,
    ContactModule,
    ProductModule,
    FieldConfigModule,
    OrderModule,
    StockModule,
    PaymentConditionModule,
    PriceListModule,
    CommissionModule,
    FinanceModule,
    RouteModule,
    ModuleModule,
    PlanModule,
    RoleModule,
    UserModule,
    IntentModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    AccountController,
    CompanyController,
    ContactController,
    ProductController,
    FieldConfigController,
    OrderController,
    StockController,
    PaymentConditionController,
    PriceListController,
    CommissionController,
    FinanceController,
    RouteController,
    ModuleController,
    RoleController,
    UserController,
    IntentController,
  ],
})
export class HttpModule {}
