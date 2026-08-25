import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ApplyCouponCommand } from './apply-coupon.command';
import { ApplyCouponResultDto } from '../../dto/apply-coupon-result.dto';
import {
  COUPON_REPOSITORY,
  CouponRepositoryPort,
} from '../../ports/output/coupon-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '@infrastructure/persistence/ports/unit-of-work.port';
import { CouponCode } from '@contexts/coupon/domain/value-objects/coupon-code.vo';
import { CouponNotFoundException } from '@contexts/coupon/domain/exceptions/coupon-not-found.exception';

@Injectable()
export class ApplyCouponUseCase implements UseCase<ApplyCouponCommand, ApplyCouponResultDto> {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: CouponRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ApplyCouponCommand): Promise<ApplyCouponResultDto> {
    const normalizedCode = CouponCode.from(command.code);
    const coupon = await this.couponRepository.findByCode(normalizedCode);

    if (!coupon) {
      throw new CouponNotFoundException(command.code);
    }

    coupon.validate();
    const discountAmount = coupon.calculateDiscount(command.subtotal);

    const saved = await this.unitOfWork.execute(async () => {
      coupon.incrementUsage();
      return this.couponRepository.save(coupon);
    });

    return ApplyCouponResultDto.fromDomain(saved, discountAmount);
  }
}
