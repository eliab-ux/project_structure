import { DomainException } from '@gitspread/domain-primitives';

/** Name contains "NotFound", which GlobalExceptionFilter maps to HTTP 404. */
export class PlanNotFoundException extends DomainException {
  constructor(reference: string) {
    // A plan code is public catalogue information, safe to echo.
    super(`Plano não encontrado: ${reference}.`);
  }
}
