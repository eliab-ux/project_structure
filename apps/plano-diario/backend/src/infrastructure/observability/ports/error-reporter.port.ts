export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  /** Já sanitizado — nunca contém senha, token, apikey ou outro dado sensível. */
  context?: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Fronteira de error-reporting. Preparação para a ferramenta própria de monitoramento
 * (`<NomeDoGuard>` — sem vínculo com a Spread). O adapter default é no-op; quando a
 * ferramenta existir, só o provider ERROR_REPORTER muda.
 */
export interface ErrorReporterPort {
  /** Fire-and-forget: NUNCA lança, NUNCA bloqueia a resposta ao cliente. */
  report(scenario: ErrorScenario): void;
}
