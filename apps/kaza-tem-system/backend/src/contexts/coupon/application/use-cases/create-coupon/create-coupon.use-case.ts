import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Coupon } from '@contexts/coupon/domain/entities/coupon.entity';
import { CouponCode } from '@contexts/coupon/domain/value-objects/coupon-code.vo';
import { CouponDto } from '../../dto/coupon.dto';
import { CreateCouponCommand } from './create-coupon.command';
import {
  COUPON_REPOSITORY,
  CouponRepositoryPort,
} from '../../ports/output/coupon-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '@infrastructure/persistence/ports/unit-of-work.port';
import { CouponAlreadyExistsException } from '@contexts/coupon/domain/exceptions/coupon-already-exists.exception';

@Injectable()
export class CreateCouponUseCase implements UseCase<CreateCouponCommand, CouponDto> {
  constructor(
    @Inject(COUPON_REPOSITORY)
    private readonly couponRepository: CouponRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: CreateCouponCommand): Promise<CouponDto> {
    const normalizedCode = CouponCode.from(command.code);

    const existing = await this.couponRepository.findByCode(normalizedCode);
    if (existing) {
      throw new CouponAlreadyExistsException(normalizedCode.value);
    }

    const coupon = Coupon.create({
      code: normalizedCode.value,
      discountType: command.discountType,
      discountValue: command.discountValue,
      validFrom: command.validFrom,
      validUntil: command.validUntil,
      usageLimit: command.usageLimit,
      resellerId: command.resellerId ?? null,
      isActive: command.isActive,
    });

    return this.unitOfWork.execute(async () => {
      const saved = await this.couponRepository.save(coupon);
      return CouponDto.fromDomain(saved);
    });
  }
}
