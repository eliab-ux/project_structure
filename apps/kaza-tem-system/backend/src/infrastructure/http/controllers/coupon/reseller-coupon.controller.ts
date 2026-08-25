import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResellerGuard } from '@infrastructure/security/guards/reseller.guard';
import { CurrentUser } from '@infrastructure/security/decorators/current-user.decorator';
import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';
import { CreateCouponUseCase } from '@contexts/coupon/application/use-cases/create-coupon/create-coupon.use-case';
import { ListCouponsUseCase } from '@contexts/coupon/application/use-cases/list-coupons/list-coupons.use-case';
import { CreateCouponCommand } from '@contexts/coupon/application/use-cases/create-coupon/create-coupon.command';
import { ListCouponsQuery } from '@contexts/coupon/application/use-cases/list-coupons/list-coupons.query';
import { CouponAlreadyExistsException } from '@contexts/coupon/domain/exceptions/coupon-already-exists.exception';
import { CreateCouponRequestDto } from './dto/create-coupon.request.dto';
import { CouponResponseDto } from './dto/coupon.response.dto';

@Controller('resellers/coupons')
@UseGuards(ResellerGuard)
export class ResellerCouponController {
  constructor(
    private readonly createCouponUseCase: CreateCouponUseCase,
    private readonly listCouponsUseCase: ListCouponsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCouponRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<CouponResponseDto> {
    try {
      const validFrom = this.parseDate(dto.validFrom);
      const validUntil = this.parseDate(dto.validUntil);

      if (!validUntil) {
        throw new BadRequestException('validUntil is required');
      }

      const resellerId = user.resellerId;
      if (!resellerId) {
        throw new HttpException('Reseller information missing', HttpStatus.FORBIDDEN);
      }

      const command = new CreateCouponCommand(
        dto.code,
        dto.discountType,
        dto.discountValue,
        validUntil,
        validFrom,
        dto.usageLimit,
        resellerId,
        dto.isActive,
      );

      const coupon = await this.createCouponUseCase.execute(command);
      return CouponResponseDto.fromDto(coupon);
    } catch (error) {
      if (error instanceof CouponAlreadyExistsException) {
        throw new HttpException('Cupom já existe', HttpStatus.CONFLICT);
      }

      throw error;
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<CouponResponseDto[]> {
    try {
      const resellerId = user.resellerId;
      if (!resellerId) {
        throw new HttpException('Reseller information missing', HttpStatus.FORBIDDEN);
      }

      const coupons = await this.listCouponsUseCase.execute(
        new ListCouponsQuery(resellerId, undefined),
      );

      return coupons.map((coupon) => CouponResponseDto.fromDto(coupon));
    } catch (error) {
      throw error;
    }
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    return date;
  }
}
