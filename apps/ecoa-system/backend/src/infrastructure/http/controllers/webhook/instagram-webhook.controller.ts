import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { InstagramWebhookPayload, InstagramWebhookService } from './instagram-webhook.service';

type RawFastifyRequest = FastifyRequest & { rawBody?: Buffer };

/**
 * PUBLIC endpoint — intentionally NOT guarded by JwtAuthGuard: Meta calls it without a JWT.
 * Trust is established instead by (GET) the verify token and (POST) the X-Hub-Signature-256 HMAC.
 * A single endpoint receives events for ALL tenants; the service resolves the owning tenant by
 * ig_user_id and discards orphan events.
 */
@Controller('webhooks/instagram')
export class InstagramWebhookController {
  constructor(private readonly webhookService: InstagramWebhookService) {}

  @Get()
  handshake(@Query() query: Record<string, string>): string {
    const challenge = this.webhookService.verifyHandshake(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );
    if (challenge === null) {
      throw new ForbiddenException('Verify token inválido');
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() request: RawFastifyRequest): Promise<{ received: boolean }> {
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    if (!this.webhookService.verifySignature(request.rawBody, signature)) {
      // Reject anything without a valid signature — never trust an unsigned payload.
      throw new ForbiddenException('Assinatura inválida');
    }

    const payload = request.body as InstagramWebhookPayload;
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload inválido');
    }

    // Process inline but fast; the ingestion path is idempotent so a Meta retry is a no-op.
    // (Moving this to a BullMQ queue is a drop-in — the logic already lives in the service.)
    await this.webhookService.process(request.rawBody, payload);
    return { received: true };
  }
}
