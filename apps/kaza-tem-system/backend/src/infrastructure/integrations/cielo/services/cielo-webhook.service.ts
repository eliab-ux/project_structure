import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

const SIGNATURE_HEADER = 'x-cielo-signature';

@Injectable()
export class CieloWebhookValidationService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.getOrThrow<string>('CIELO_WEBHOOK_SECRET');
  }

  validate(signature: string | undefined, payload: string): boolean {
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');
    return expected === signature;
  }

  static getSignatureHeaderName(): string {
    return SIGNATURE_HEADER;
  }
}
