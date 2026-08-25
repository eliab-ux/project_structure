import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CouponDto } from '../../dto/coupon.dto';
import { ValidateCouponQuery } from './validate-coupon.query';
import {
  COUPON_REPOSITORY,
  CouponRepositoryPort,
} from '../../ports/output/coupon-repository.port';
import { CouponCode } from '@contexts/coupon/domain/value-objects/coupon-code.vo';
import { CouponNotFoundException } from '@contexts/coupon/domain/exceptions/coupon-not-found.exception';

@Injectable()
export class ValidateCouponUseCase implements UseCase<ValidateCouponQuery, CouponDto> {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: CouponRepositoryPort,
  ) {}

  async execute(query: ValidateCouponQuery): Promise<CouponDto> {
    const coupon = await this.couponRepository.findByCode(CouponCode.from(query.code));
    if (!coupon) {
      throw new CouponNotFoundException(query.code);
    }

    coupon.validate();
    return CouponDto.fromDomain(coupon);
  }
}
