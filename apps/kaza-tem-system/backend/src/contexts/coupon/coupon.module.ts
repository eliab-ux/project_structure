import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CreateCouponUseCase } from './application/use-cases/create-coupon/create-coupon.use-case';
import { ValidateCouponUseCase } from './application/use-cases/validate-coupon/validate-coupon.use-case';
import { ApplyCouponUseCase } from './application/use-cases/apply-coupon/apply-coupon.use-case';
import { ListCouponsUseCase } from './application/use-cases/list-coupons/list-coupons.use-case';
import { COUPON_REPOSITORY } from './application/ports/output/coupon-repository.port';
import { MikroOrmCouponRepository } from '@infrastructure/persistence/mikro-orm/repositories/coupon.repository';
import { CouponMapper } from '@infrastructure/persistence/mikro-orm/mappers/coupon.mapper';
import { CouponOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/coupon-orm.entity';

@Module({
  imports: [MikroOrmModule.forFeature([CouponOrmEntity])],
  providers: [
    CouponMapper,
    {
      provide: COUPON_REPOSITORY,
      useClass: MikroOrmCouponRepository,
    },
    CreateCouponUseCase,
    ValidateCouponUseCase,
    ApplyCouponUseCase,
    ListCouponsUseCase,
  ],
  exports: [
    CreateCouponUseCase,
    ValidateCouponUseCase,
    ApplyCouponUseCase,
    ListCouponsUseCase,
  ],
})
export class CouponModule {}
