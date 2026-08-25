import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ValidateCouponUseCase } from '@contexts/coupon/application/use-cases/validate-coupon/validate-coupon.use-case';
import { ValidateCouponQuery } from '@contexts/coupon/application/use-cases/validate-coupon/validate-coupon.query';
import { CouponResponseDto } from './dto/coupon.response.dto';
import { CouponNotFoundException } from '@contexts/coupon/domain/exceptions/coupon-not-found.exception';
import { CouponExpiredException } from '@contexts/coupon/domain/exceptions/coupon-expired.exception';
import { CouponLimitReachedException } from '@contexts/coupon/domain/exceptions/coupon-limit-reached.exception';

@Controller('coupons')
export class PublicCouponController {
  constructor(private readonly validateCouponUseCase: ValidateCouponUseCase) {}

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Query('code') code: string): Promise<CouponResponseDto> {
    try {
      const coupon = await this.validateCouponUseCase.execute(
        new ValidateCouponQuery(code),
      );
      return CouponResponseDto.fromDto(coupon);
    } catch (error) {
      if (error instanceof CouponNotFoundException) {
        throw new NotFoundException('Cupom não encontrado');
      }

      if (
        error instanceof CouponExpiredException ||
        error instanceof CouponLimitReachedException
      ) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
