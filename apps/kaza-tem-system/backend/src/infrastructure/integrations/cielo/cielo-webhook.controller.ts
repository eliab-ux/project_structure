import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CieloWebhookDto } from './dto/cielo-webhook.dto';
import { CieloWebhookProcessor } from './cielo-webhook.processor';

@Controller('payments')
export class CieloWebhookController {
  constructor(private readonly processor: CieloWebhookProcessor) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: CieloWebhookDto): Promise<void> {
    await this.processor.process(payload);
  }
}
