import { DomainException } from '@gitspread/domain-primitives';

/**
 * A single Instagram account (ig_user_id) may be connected by only ONE tenant. The second
 * attempt is rejected — the message is safe to expose (no token, no other tenant's identity).
 *
 * English because the app's default locale is English (see frontend `src/i18n/`).
 */
export class InstagramAlreadyConnectedException extends DomainException {
  constructor() {
    super('This Instagram account is already connected to another Ecoa user.');
  }
}
