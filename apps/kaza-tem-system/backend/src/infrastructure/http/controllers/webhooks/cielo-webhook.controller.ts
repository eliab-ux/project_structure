import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CieloWebhookDto } from '@infrastructure/integrations/cielo/dto/cielo-webhook.dto';
import { CieloWebhookProcessor } from '@infrastructure/integrations/cielo/cielo-webhook.processor';
import { CieloWebhookValidationService } from '@infrastructure/integrations/cielo/services/cielo-webhook.service';

@Controller('webhooks/cielo')
export class CieloWebhookListenerController {
  constructor(
    private readonly processor: CieloWebhookProcessor,
    private readonly validation: CieloWebhookValidationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() payload: CieloWebhookDto,
    @Headers('x-cielo-signature') signature?: string,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    if (!this.validation.validate(signature, body)) {
      throw new UnauthorizedException('Assinatura inválida para o webhook da Cielo');
    }

    await this.processor.process(payload);
  }
}
