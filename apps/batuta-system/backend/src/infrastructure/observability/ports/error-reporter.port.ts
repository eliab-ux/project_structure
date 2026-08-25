export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  /** Already sanitized at the source — never password, token, phone number or message body. */
  context?: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Error-reporting boundary. Prepares the app for the future in-house monitoring tool
 * (no relation to Spread/SpreadGuard). The default adapter is a no-op; when the real
 * ingestion endpoint exists, swapping the ERROR_REPORTER provider is the only change.
 */
export interface ErrorReporterPort {
  /** Fire-and-forget: NEVER throws, NEVER blocks the response to the client. */
  report(scenario: ErrorScenario): void;
}
