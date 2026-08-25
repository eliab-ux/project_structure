import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CieloCheckoutService } from '@infrastructure/integrations/cielo/cielo-checkout.service';
import { CieloPaymentResponseDto } from '@infrastructure/integrations/cielo/dto/cielo-payment.response.dto';
import { CieloRefundRequestDto } from './dto/cielo-refund.request.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly cieloCheckoutService: CieloCheckoutService) {}

  @Get(':id')
  async getPayment(@Param('id') paymentId: string): Promise<CieloPaymentResponseDto> {
    return this.cieloCheckoutService.getPayment(paymentId);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(
    @Param('id') paymentId: string,
    @Body() dto: CieloRefundRequestDto,
  ): Promise<CieloPaymentResponseDto> {
    return this.cieloCheckoutService.cancelPayment(paymentId, dto.amount);
  }
}
