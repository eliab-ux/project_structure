import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CouponDto } from '../../dto/coupon.dto';
import { ListCouponsQuery } from './list-coupons.query';
import {
  COUPON_REPOSITORY,
  CouponRepositoryPort,
} from '../../ports/output/coupon-repository.port';

@Injectable()
export class ListCouponsUseCase implements UseCase<ListCouponsQuery, CouponDto[]> {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: CouponRepositoryPort,
  ) {}

  async execute(query: ListCouponsQuery): Promise<CouponDto[]> {
    const coupons = await this.couponRepository.findAll({
      resellerId: query.resellerId,
      isActive: query.isActive,
    });

    return coupons.map((coupon) => CouponDto.fromDomain(coupon));
  }
}
