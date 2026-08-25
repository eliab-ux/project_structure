import { Module } from '@nestjs/common';
import { HttpModule as NestHttpModule } from '@nestjs/axios';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MarketplaceApiKeyOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { MarketplaceAuthGuard } from '@infrastructure/http/guards/marketplace-auth.guard';
import { UserModule } from '../../contexts/user/user.module';
import { ResellerModule } from '../../contexts/reseller/reseller.module';
import { ProductModule } from '../../contexts/product/product.module';
import { OrderModule } from '../../contexts/order/order.module';
import { AuthModule } from './auth.module';
import { CieloModule } from '@infrastructure/integrations/cielo/cielo.module';
import { ShippingModule } from '@infrastructure/shipping/shipping.module';
import { CommissionModule } from '../../contexts/commission/commission.module';
import { CouponModule } from '../../contexts/coupon/coupon.module';
import { MaterialsModule } from '../../contexts/materials/materials.module';
import { UserController } from './controllers/user/user.controller';
import { ResellerController } from './controllers/reseller/reseller.controller';
import { ResellerDashboardController } from './controllers/reseller/reseller-dashboard.controller';
import { ProductController } from './controllers/product/product.controller';
import { OrderController } from './controllers/order/order.controller';
import { PaymentController } from './controllers/payment/payment.controller';
import { CieloWebhookController } from '@infrastructure/integrations/cielo/cielo-webhook.controller';
import { AdminDashboardController } from './controllers/admin/dashboard.controller';
import { AdminOrderController } from './controllers/admin/order.controller';
import { AdminResellerController } from './controllers/admin/reseller.controller';
import { AdminMarketplaceController } from './controllers/admin/admin-marketplace.controller';
import { AdminProductsController } from './controllers/admin/admin-products.controller';
import { MarketplaceProductsController } from './controllers/marketplace/marketplace-products.controller';
import { AnalyticsModule } from '@contexts/analytics/analytics.module';
import { WithdrawalModule } from '@contexts/withdrawal/withdrawal.module';
import { SubscriptionModule } from '@contexts/subscription/subscription.module';
import { WithdrawalController } from './controllers/withdrawal/withdrawal.controller';
import { AdminWithdrawalController } from './controllers/admin/admin-withdrawal.controller';
import { TrackingController } from './controllers/tracking/tracking.controller';
import { SubscriptionController } from './controllers/subscription/subscription.controller';
import { CieloWebhookListenerController } from './controllers/webhooks/cielo-webhook.controller';
import { AdminCouponController } from './controllers/coupon/admin-coupon.controller';
import { PublicCouponController } from './controllers/coupon/public-coupon.controller';
import { ResellerCouponController } from './controllers/coupon/reseller-coupon.controller';
import { AdminMaterialController } from './controllers/materials/admin-material.controller';
import { ResellerMaterialController } from './controllers/materials/reseller-material.controller';
@Module({
  imports: [
    NestHttpModule,
    MikroOrmModule.forFeature([MarketplaceApiKeyOrmEntity]),
    UserModule,
    ProductModule,
    ResellerModule,
    AuthModule,
    OrderModule,
    CieloModule,
    CommissionModule,
    CouponModule,
    MaterialsModule,
    AnalyticsModule,
    ShippingModule,
    WithdrawalModule,
    SubscriptionModule,
  ],
  providers: [MarketplaceAuthGuard],
  controllers: [
    UserController,
    ProductController,
    ResellerController,
    OrderController,
    PaymentController,
    CieloWebhookController,
    CieloWebhookListenerController,
    MarketplaceProductsController,
    AdminDashboardController,
    AdminOrderController,
    AdminResellerController,
    AdminMarketplaceController,
    AdminProductsController,
    AdminWithdrawalController,
    WithdrawalController,
    TrackingController,
    SubscriptionController,
    AdminCouponController,
    PublicCouponController,
    ResellerCouponController,
    AdminMaterialController,
    ResellerMaterialController,
    ResellerDashboardController,
  ],
})
export class HttpModule {}
