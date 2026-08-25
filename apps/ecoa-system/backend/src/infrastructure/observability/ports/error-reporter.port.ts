export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  /** Already sanitized — never contains password, token, or other sensitive data. */
  context?: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Error-reporting boundary. Preparation for the future "Guard" monitoring tool
 * (no vínculo com a Spread). The default adapter is a no-op; swapping the provider
 * is the only change needed once the real ingestion endpoint exists.
 */
export interface ErrorReporterPort {
  /** Fire-and-forget: NEVER throws, NEVER blocks the response to the client. */
  report(scenario: ErrorScenario): void;
}
