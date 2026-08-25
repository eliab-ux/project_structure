import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { UseCase } from '@gitspread/shared-kernel';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../../../../infrastructure/integrations/instagram/ports/instagram-gateway.port';

export interface GetOAuthUrlQuery {
  ownerId: string;
}

export interface GetOAuthUrlResult {
  url: string;
  /** Anti-CSRF nonce. The frontend stores it and MUST echo it back on the callback. */
  state: string;
}

@Injectable()
export class GetOAuthUrlUseCase implements UseCase<GetOAuthUrlQuery, GetOAuthUrlResult> {
  constructor(
    @Inject(INSTAGRAM_GATEWAY)
    private readonly gateway: InstagramGatewayPort,
  ) {}

  async execute(_query: GetOAuthUrlQuery): Promise<GetOAuthUrlResult> {
    // The tenant is already known from the JWT on the callback, so `state` only needs to be an
    // unguessable nonce the frontend round-trips to defend against login-CSRF.
    const state = randomBytes(16).toString('hex');
    return { url: this.gateway.buildOAuthUrl(state), state };
  }
}
