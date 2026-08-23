import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { PLAN_REPOSITORY } from '../../contexts/plan/application/ports/output/plan-repository.port';
import { ACCOUNT_REPOSITORY } from '../../contexts/account/application/ports/output/account-repository.port';
import { COMPANY_REPOSITORY } from '../../contexts/company/application/ports/output/company-repository.port';
import { ROLE_REPOSITORY } from '../../contexts/role/application/ports/output/role-repository.port';
import { USER_REPOSITORY } from '../../contexts/user/application/ports/output/user-repository.port';
import { PASSWORD_RESET_CODE_REPOSITORY } from '../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { ACCOUNT_MODULE_REPOSITORY } from '../../contexts/module/application/ports/output/account-module-repository.port';
import { FIELD_CONFIG_REPOSITORY } from '../../contexts/field-config/application/ports/output/field-config-repository.port';
import { ORDER_REPOSITORY } from '../../contexts/order/application/ports/output/order-repository.port';
import { STOCK_MOVEMENT_REPOSITORY } from '../../contexts/stock/application/ports/output/stock-movement-repository.port';
import { STOCK_RESERVATION_REPOSITORY } from '../../contexts/stock/application/ports/output/stock-reservation-repository.port';
import { STOCK_LOCATION_REPOSITORY } from '../../contexts/stock/application/ports/output/stock-location-repository.port';
import { PRODUCT_COMPONENT_REPOSITORY } from '../../contexts/product/application/ports/output/product-component-repository.port';
import { PAYMENT_CONDITION_REPOSITORY } from '../../contexts/payment-condition/application/ports/output/payment-condition-repository.port';
import { PRICE_LIST_REPOSITORY } from '../../contexts/price-list/application/ports/output/price-list-repository.port';
import { COMMISSION_TIER_REPOSITORY } from '../../contexts/commission/application/ports/output/commission-tier-repository.port';
import { SALES_TARGET_REPOSITORY } from '../../contexts/commission/application/ports/output/sales-target-repository.port';
import { FINANCIAL_ACCOUNT_REPOSITORY } from '../../contexts/finance/application/ports/output/financial-account-repository.port';
import { FINANCIAL_CATEGORY_REPOSITORY } from '../../contexts/finance/application/ports/output/financial-category-repository.port';
import { FINANCIAL_TITLE_REPOSITORY } from '../../contexts/finance/application/ports/output/financial-title-repository.port';
import { LATE_CHARGE_PARAMS } from '../../contexts/finance/application/ports/output/late-charge-params.port';
import { ROUTE_REPOSITORY } from '../../contexts/route/application/ports/output/route-repository.port';
import { COMMERCIAL_RULE_REPOSITORY } from '../../contexts/route/application/ports/output/commercial-rule-repository.port';

import { PlanOrmEntity } from './mikro-orm/entities/plan-orm.entity';
import { AccountOrmEntity } from './mikro-orm/entities/account-orm.entity';
import { CompanyOrmEntity } from './mikro-orm/entities/company-orm.entity';
import { RoleOrmEntity } from './mikro-orm/entities/role-orm.entity';
import { UserOrmEntity } from './mikro-orm/entities/user-orm.entity';
import { PasswordResetCodeOrmEntity } from './mikro-orm/entities/password-reset-code-orm.entity';
import { ModuleOrmEntity } from './mikro-orm/entities/module-orm.entity';
import { AccountModuleOrmEntity } from './mikro-orm/entities/account-module-orm.entity';
import { FieldConfigOrmEntity } from './mikro-orm/entities/field-config-orm.entity';
import { OrderOrmEntity } from './mikro-orm/entities/order-orm.entity';
import { OrderItemOrmEntity } from './mikro-orm/entities/order-item-orm.entity';
import { OrderCounterOrmEntity } from './mikro-orm/entities/order-counter-orm.entity';
import { StockMovementOrmEntity } from './mikro-orm/entities/stock-movement-orm.entity';
import { StockReservationOrmEntity } from './mikro-orm/entities/stock-reservation-orm.entity';
import { StockLocationOrmEntity } from './mikro-orm/entities/stock-location-orm.entity';
import { ProductComponentOrmEntity } from './mikro-orm/entities/product-component-orm.entity';
import { PaymentConditionOrmEntity } from './mikro-orm/entities/payment-condition-orm.entity';
import { OrderPaymentOrmEntity } from './mikro-orm/entities/order-payment-orm.entity';
import { PriceListOrmEntity } from './mikro-orm/entities/price-list-orm.entity';
import { PriceListItemOrmEntity } from './mikro-orm/entities/price-list-item-orm.entity';
import { CommissionATierOrmEntity } from './mikro-orm/entities/commission-a-tier-orm.entity';
import { SalesTargetOrmEntity } from './mikro-orm/entities/sales-target-orm.entity';
import { FinancialAccountOrmEntity } from './mikro-orm/entities/financial-account-orm.entity';
import { FinancialCategoryOrmEntity } from './mikro-orm/entities/financial-category-orm.entity';
import { FinancialTitleOrmEntity } from './mikro-orm/entities/financial-title-orm.entity';
import { TitleSettlementOrmEntity } from './mikro-orm/entities/title-settlement-orm.entity';
import { RouteOrmEntity } from './mikro-orm/entities/route-orm.entity';
import { CommercialRuleOrmEntity } from './mikro-orm/entities/commercial-rule-orm.entity';

import { PlanMapper } from './mikro-orm/mappers/plan.mapper';
import { AccountMapper } from './mikro-orm/mappers/account.mapper';
import { CompanyMapper } from './mikro-orm/mappers/company.mapper';
import { RoleMapper } from './mikro-orm/mappers/role.mapper';
import { UserMapper } from './mikro-orm/mappers/user.mapper';
import { FieldConfigMapper } from './mikro-orm/mappers/field-config.mapper';
import { OrderMapper } from './mikro-orm/mappers/order.mapper';
import { StockMovementMapper } from './mikro-orm/mappers/stock-movement.mapper';
import { StockReservationMapper } from './mikro-orm/mappers/stock-reservation.mapper';

import { MikroOrmPlanRepository } from './mikro-orm/repositories/plan.repository';
import { MikroOrmAccountRepository } from './mikro-orm/repositories/account.repository';
import { MikroOrmCompanyRepository } from './mikro-orm/repositories/company.repository';
import { MikroOrmRoleRepository } from './mikro-orm/repositories/role.repository';
import { MikroOrmUserRepository } from './mikro-orm/repositories/user.repository';
import { MikroOrmPasswordResetCodeRepository } from './mikro-orm/repositories/password-reset-code.repository';
import { MikroOrmAccountModuleRepository } from './mikro-orm/repositories/account-module.repository';
import { MikroOrmFieldConfigRepository } from './mikro-orm/repositories/field-config.repository';
import { MikroOrmOrderRepository } from './mikro-orm/repositories/order.repository';
import { MikroOrmStockMovementRepository } from './mikro-orm/repositories/stock-movement.repository';
import { MikroOrmStockReservationRepository } from './mikro-orm/repositories/stock-reservation.repository';
import { MikroOrmStockLocationRepository } from './mikro-orm/repositories/stock-location.repository';
import { MikroOrmProductComponentRepository } from './mikro-orm/repositories/product-component.repository';
import { MikroOrmPaymentConditionRepository } from './mikro-orm/repositories/payment-condition.repository';
import { MikroOrmPriceListRepository } from './mikro-orm/repositories/price-list.repository';
import { MikroOrmCommissionTierRepository } from './mikro-orm/repositories/commission-tier.repository';
import { MikroOrmSalesTargetRepository } from './mikro-orm/repositories/sales-target.repository';
import { MikroOrmFinancialAccountRepository } from './mikro-orm/repositories/financial-account.repository';
import { MikroOrmFinancialCategoryRepository } from './mikro-orm/repositories/financial-category.repository';
import { MikroOrmFinancialTitleRepository } from './mikro-orm/repositories/financial-title.repository';
import { LateChargeParamsReader } from './mikro-orm/repositories/late-charge-params.reader';
import { MikroOrmRouteRepository } from './mikro-orm/repositories/route.repository';
import { MikroOrmCommercialRuleRepository } from './mikro-orm/repositories/commercial-rule.repository';

/**
 * Every repository, in one @Global module.
 *
 * The alternative — each context module providing its own — reads tidier on paper and produces
 * circular imports in practice: deleting a role has to count the users holding it, creating a user
 * has to read the role, and onboarding touches four contexts at once. Those are real relationships,
 * not accidents of layering, and `forwardRef` chains would be the cost of pretending otherwise.
 *
 * What matters for the architecture is preserved: use cases still depend on the PORT symbols and
 * never on a concrete repository, so nothing here leaks into the application layer.
 */
@Global()
@Module({
  imports: [
    MikroOrmModule.forFeature([
      PlanOrmEntity,
      AccountOrmEntity,
      CompanyOrmEntity,
      RoleOrmEntity,
      UserOrmEntity,
      PasswordResetCodeOrmEntity,
      ModuleOrmEntity,
      AccountModuleOrmEntity,
      FieldConfigOrmEntity,
      OrderOrmEntity,
      OrderItemOrmEntity,
      OrderCounterOrmEntity,
      StockMovementOrmEntity,
      StockReservationOrmEntity,
      StockLocationOrmEntity,
      ProductComponentOrmEntity,
      PaymentConditionOrmEntity,
      // Dormente (§4.1 do 02A): registrada para o schema/verify:isolation enxergarem a tabela; sem
      // repositório/fluxo até o PDV/TEF existir.
      OrderPaymentOrmEntity,
      PriceListOrmEntity,
      PriceListItemOrmEntity,
      CommissionATierOrmEntity,
      SalesTargetOrmEntity,
      FinancialAccountOrmEntity,
      FinancialCategoryOrmEntity,
      FinancialTitleOrmEntity,
      TitleSettlementOrmEntity,
      RouteOrmEntity,
      CommercialRuleOrmEntity,
    ]),
  ],
  providers: [
    PlanMapper,
    AccountMapper,
    CompanyMapper,
    RoleMapper,
    UserMapper,
    FieldConfigMapper,
    OrderMapper,
    StockMovementMapper,
    StockReservationMapper,
    { provide: PLAN_REPOSITORY, useClass: MikroOrmPlanRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: MikroOrmAccountRepository },
    { provide: COMPANY_REPOSITORY, useClass: MikroOrmCompanyRepository },
    { provide: ROLE_REPOSITORY, useClass: MikroOrmRoleRepository },
    { provide: USER_REPOSITORY, useClass: MikroOrmUserRepository },
    {
      provide: PASSWORD_RESET_CODE_REPOSITORY,
      useClass: MikroOrmPasswordResetCodeRepository,
    },
    { provide: ACCOUNT_MODULE_REPOSITORY, useClass: MikroOrmAccountModuleRepository },
    { provide: FIELD_CONFIG_REPOSITORY, useClass: MikroOrmFieldConfigRepository },
    { provide: ORDER_REPOSITORY, useClass: MikroOrmOrderRepository },
    { provide: STOCK_MOVEMENT_REPOSITORY, useClass: MikroOrmStockMovementRepository },
    { provide: STOCK_RESERVATION_REPOSITORY, useClass: MikroOrmStockReservationRepository },
    { provide: STOCK_LOCATION_REPOSITORY, useClass: MikroOrmStockLocationRepository },
    { provide: PRODUCT_COMPONENT_REPOSITORY, useClass: MikroOrmProductComponentRepository },
    { provide: PAYMENT_CONDITION_REPOSITORY, useClass: MikroOrmPaymentConditionRepository },
    { provide: PRICE_LIST_REPOSITORY, useClass: MikroOrmPriceListRepository },
    { provide: COMMISSION_TIER_REPOSITORY, useClass: MikroOrmCommissionTierRepository },
    { provide: SALES_TARGET_REPOSITORY, useClass: MikroOrmSalesTargetRepository },
    { provide: FINANCIAL_ACCOUNT_REPOSITORY, useClass: MikroOrmFinancialAccountRepository },
    { provide: FINANCIAL_CATEGORY_REPOSITORY, useClass: MikroOrmFinancialCategoryRepository },
    { provide: FINANCIAL_TITLE_REPOSITORY, useClass: MikroOrmFinancialTitleRepository },
    { provide: LATE_CHARGE_PARAMS, useClass: LateChargeParamsReader },
    { provide: ROUTE_REPOSITORY, useClass: MikroOrmRouteRepository },
    { provide: COMMERCIAL_RULE_REPOSITORY, useClass: MikroOrmCommercialRuleRepository },
  ],
  exports: [
    PLAN_REPOSITORY,
    ACCOUNT_REPOSITORY,
    COMPANY_REPOSITORY,
    ROLE_REPOSITORY,
    USER_REPOSITORY,
    PASSWORD_RESET_CODE_REPOSITORY,
    ACCOUNT_MODULE_REPOSITORY,
    FIELD_CONFIG_REPOSITORY,
    ORDER_REPOSITORY,
    STOCK_MOVEMENT_REPOSITORY,
    STOCK_RESERVATION_REPOSITORY,
    STOCK_LOCATION_REPOSITORY,
    PRODUCT_COMPONENT_REPOSITORY,
    PAYMENT_CONDITION_REPOSITORY,
    PRICE_LIST_REPOSITORY,
    COMMISSION_TIER_REPOSITORY,
    SALES_TARGET_REPOSITORY,
    FINANCIAL_ACCOUNT_REPOSITORY,
    FINANCIAL_CATEGORY_REPOSITORY,
    FINANCIAL_TITLE_REPOSITORY,
    LATE_CHARGE_PARAMS,
    ROUTE_REPOSITORY,
    COMMERCIAL_RULE_REPOSITORY,
  ],
})
export class RepositoriesModule {}
