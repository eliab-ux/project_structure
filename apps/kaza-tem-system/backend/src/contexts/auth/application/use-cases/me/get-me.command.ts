import { AuthTokenPayload } from '@infrastructure/security/ports/token-service.port';

export class GetMeCommand {
  constructor(public readonly payload: AuthTokenPayload) {}
}
