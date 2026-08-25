import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { CreateCouponUseCase } from '@contexts/coupon/application/use-cases/create-coupon/create-coupon.use-case';
import { ListCouponsUseCase } from '@contexts/coupon/application/use-cases/list-coupons/list-coupons.use-case';
import { CreateCouponCommand } from '@contexts/coupon/application/use-cases/create-coupon/create-coupon.command';
import { ListCouponsQuery } from '@contexts/coupon/application/use-cases/list-coupons/list-coupons.query';
import { CouponAlreadyExistsException } from '@contexts/coupon/domain/exceptions/coupon-already-exists.exception';
import { CreateCouponRequestDto } from './dto/create-coupon.request.dto';
import { CouponResponseDto } from './dto/coupon.response.dto';
import { ListCouponsQueryDto } from './dto/list-coupons.query.dto';

@Controller('admin/coupons')
@UseGuards(AdminGuard)
export class AdminCouponController {
  constructor(
    private readonly createCouponUseCase: CreateCouponUseCase,
    private readonly listCouponsUseCase: ListCouponsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCouponRequestDto): Promise<CouponResponseDto> {
    try {
      const validFrom = this.parseDate(dto.validFrom);
      const validUntil = this.parseDate(dto.validUntil);

      if (!validUntil) {
        throw new BadRequestException('validUntil is required');
      }

      const command = new CreateCouponCommand(
        dto.code,
        dto.discountType,
        dto.discountValue,
        validUntil,
        validFrom,
        dto.usageLimit,
        dto.resellerId ?? null,
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
  async list(@Query() query: ListCouponsQueryDto): Promise<CouponResponseDto[]> {
    try {
      const isActive =
        typeof query.isActive === 'undefined'
          ? undefined
          : query.isActive === 'true' || query.isActive === '1';

      const coupons = await this.listCouponsUseCase.execute(
        new ListCouponsQuery(query.resellerId ?? null, isActive),
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
