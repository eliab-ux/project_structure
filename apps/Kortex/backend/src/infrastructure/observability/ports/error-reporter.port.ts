export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  /** Já sanitizado na origem — nunca senha, token, CPF, CNPJ, endereço ou valor em dinheiro. */
  context?: Record<string, unknown>;
  occurredAt: string;
}

/**
 * Fronteira de error-reporting. Prepara a aplicação para a ferramenta própria de monitoramento
 * (VEXGuard), que ainda não existe. O adapter padrão é no-op; quando o endpoint de ingestão
 * existir, trocar o provider de ERROR_REPORTER é a única mudança.
 */
export interface ErrorReporterPort {
  /** Fire-and-forget: NUNCA lança, NUNCA bloqueia a resposta ao cliente. */
  report(scenario: ErrorScenario): void;
}
