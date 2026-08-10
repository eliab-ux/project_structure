export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  /** Already sanitised at the source — never password, token, CPF or phone number. */
  context?: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Error-reporting boundary. Prepares the app for the in-house monitoring tool (VEXGuard), which
 * does not exist yet. The default adapter is a no-op; when the ingestion endpoint exists, swapping
 * the ERROR_REPORTER provider is the only change — nothing else moves.
 */
export interface ErrorReporterPort {
  /** Fire-and-forget: NEVER throws, NEVER blocks the response to the client. */
  report(scenario: ErrorScenario): void;
}
