import { DomainException } from '@gitspread/domain-primitives';

/**
 * The authorizing Meta user manages no Facebook Page with an Instagram professional
 * (Business/Creator) account linked to it, so there is nothing for Ecoa to connect.
 *
 * This is a user-actionable precondition, not an internal failure: it must surface as a 400
 * with an explanatory message, never as a generic 500. The message is in English because the
 * app's default locale is English (see frontend `src/i18n/`).
 */
export class NoLinkedInstagramAccountException extends DomainException {
  constructor() {
    super(
      'No Instagram professional account was found. Ecoa needs an Instagram Business or ' +
        'Creator account linked to a Facebook Page you manage. Link them in the Instagram app ' +
        '(Settings → Account type and tools) and try connecting again.',
    );
  }
}
