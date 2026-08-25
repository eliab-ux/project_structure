import { Body, Controller, HttpCode, Post, UseFilters, UseGuards } from '@nestjs/common';
import { EvolutionWebhookGuard } from '../../../security/guards/evolution-webhook.guard';
import { EvolutionWebhookRequestDto } from './dto/evolution-webhook-request.dto';
import { EvolutionWebhookService } from './evolution-webhook.service';
import { WebhookPayloadRejectionFilter } from './webhook-payload-rejection.filter';

/**
 * The ONE Evolution webhook route (§5, FASE 2 item 4).
 *
 * PUBLIC as far as JWT goes — the caller is the Evolution server, which has no user session — and
 * authenticated instead by a shared token in a header, compared in constant time by
 * EvolutionWebhookGuard. That is the documented reason for the absence of JwtAuthGuard here.
 *
 * It always answers 200, even for events it does not handle yet: a provider that receives an error
 * retries, and retrying a delivery ack we cannot store yet would only produce noise. What it does
 * NOT do is swallow silently — every ignored event is logged with its reason.
 *
 * That promise had one hole, and it was expensive: a payload refused by the global ValidationPipe never
 * reached this class, so it was neither answered with 200 nor logged. WebhookPayloadRejectionFilter is
 * what makes the sentence above true for the validation step too.
 */
@Controller('webhooks/evolution')
@UseGuards(EvolutionWebhookGuard)
@UseFilters(WebhookPayloadRejectionFilter)
export class EvolutionWebhookController {
  constructor(private readonly service: EvolutionWebhookService) {}

  @Post()
  @HttpCode(200)
  async receive(@Body() dto: EvolutionWebhookRequestDto): Promise<{ received: true }> {
    await this.service.handle(dto);
    return { received: true };
  }
}
