import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DomainException } from '@gitspread/domain-primitives';
import { ErrorReporterPort } from '../../observability/ports/error-reporter.port';

/**
 * Single point of failure handling (Fail Securely). The client only ever receives a safe, generic
 * message for unexpected errors; stack traces, SQL and ORM internals stay in the logs.
 *
 * Only genuine 500s reach the ERROR_REPORTER — never an expected 4xx (business rule, validation,
 * not found, forbidden), or the monitoring would fill with noise that hides real faults.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // DomainException → the business message is safe to expose. The status follows the semantics
    // encoded in the exception's NAME, which keeps the domain free of HTTP concepts:
    //   *NotFound* → 404, *InvalidCredentials*/*Unauthorized* → 401, *Forbidden* → 403,
    //   *TooMany* → 429, else 400.
    if (exception instanceof DomainException) {
      const name = exception.constructor?.name ?? '';
      let status = 400;
      if (/NotFound/i.test(name)) {
        status = 404;
      } else if (/InvalidCredentials|Unauthorized/i.test(name)) {
        status = 401;
      } else if (/Forbidden/i.test(name)) {
        status = 403;
      } else if (/TooMany/i.test(name)) {
        // 429, e sem `Retry-After`: o cabeçalho diria ao atacante exatamente quando voltar, e a
        // janela é curta o bastante para um humano simplesmente tentar de novo.
        status = 429;
      }
      response.status(status).send({ statusCode: status, message: exception.message });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(exception.getResponse());
      return;
    }

    /**
     * A framework error that already classified itself as a CLIENT error — malformed JSON, an empty
     * body with `content-type: application/json`, a payload over the size limit. Fastify raises
     * these before any controller runs.
     *
     * Forwarding the code is not a convenience: reporting a client's malformed request as a 500
     * tells the caller "the server is broken", sends them to look in the wrong place, and pollutes
     * the error reporter. Only the CODE is forwarded, never the message — a Fastify error string
     * can name internals.
     */
    const frameworkStatus = (exception as { statusCode?: unknown })?.statusCode;
    if (typeof frameworkStatus === 'number' && frameworkStatus >= 400 && frameworkStatus < 500) {
      this.logger.warn('Requisição recusada pelo framework', {
        statusCode: frameworkStatus,
        code: (exception as { code?: string })?.code,
        path: request.url,
        method: request.method,
      });
      response
        .status(frameworkStatus)
        .send({ statusCode: frameworkStatus, message: 'Requisição inválida.' });
      return;
    }

    /**
     * Anything else → generic 500 + fire-and-forget report.
     *
     * The fields are pulled out ONE BY ONE rather than logging `exception` directly, and that is not
     * cosmetic: `Error` has no enumerable own properties, so `JSON.stringify(new Error('x'))` is
     * `{}`. Logging the object produces a line that says an unhandled exception occurred and
     * nothing about what it was — the worst kind of log entry, because it looks like diagnostics
     * while carrying none.
     */
    const error = exception as Error & { code?: string; detail?: string };
    // Nome/mensagem/rota NA STRING e o stack como SEGUNDO argumento: o ConsoleLogger do Nest só
    // renderiza assim — metadados em objeto são engolidos em produção (defeito real, 24/08/2026:
    // o log dizia "Unhandled exception" e NADA mais, o pior tipo de linha — parece diagnóstico e
    // não carrega nenhum).
    this.logger.error(
      `Unhandled ${error?.name ?? 'Error'}: ${error?.message ?? 'unknown'} — ` +
        `${request.method} ${request.url}` +
        (error?.code ? ` [code=${error.code}]` : '') +
        (error?.detail ? ` detail=${error.detail}` : ''),
      error?.stack,
    );

    try {
      this.reporter.report({
        exceptionType: error?.name ?? 'UnknownError',
        message: error?.message ?? 'unknown',
        stack: error?.stack,
        method: request.method,
        path: request.url,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // A monitoring failure must never raise a second exception masking the original one.
    }

    response.status(500).send({ statusCode: 500, message: 'Erro interno. Tente novamente.' });
  }
}
