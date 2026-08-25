import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DomainException } from '@gitspread/domain-primitives';
import { ErrorReporterPort } from '../../observability/ports/error-reporter.port';

/**
 * Single point of failure handling (Fail Securely). The client only ever receives a safe,
 * generic message for unexpected errors; stack traces, SQL and ORM internals stay in the logs.
 *
 * Only genuine 500s / unexpected exceptions reach the ERROR_REPORTER — never an expected 4xx
 * (business rule, validation, not found, forbidden).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // DomainException → the business message is safe to expose. The status follows the
    // semantics encoded in the exception name:
    //   *NotFound* → 404, *InvalidCredentials*/*Unauthorized* → 401, *Forbidden* → 403,
    //   everything else → 400.
    if (exception instanceof DomainException) {
      const name = exception.constructor?.name ?? '';
      let status = 400;
      if (/NotFound/i.test(name)) {
        status = 404;
      } else if (/InvalidCredentials|Unauthorized/i.test(name)) {
        status = 401;
      } else if (/Forbidden/i.test(name)) {
        status = 403;
      }
      response.status(status).send({ statusCode: status, message: exception.message });
      return;
    }

    // NestJS HttpException → forward the controlled status/message
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(exception.getResponse());
      return;
    }

    /**
     * A framework error that already classified itself as a CLIENT error.
     *
     * Fastify raises these before any controller runs — a malformed JSON body, an empty body with
     * `content-type: application/json`, a payload over the size limit. They carry `statusCode` in the
     * 4xx range, and forwarding it is not a convenience: reporting a client's malformed request as a
     * 500 tells the caller "the server is broken", sends them to look in the wrong place, and pollutes
     * the error reporter with noise that hides real faults.
     *
     * Only the CODE is forwarded, never the message: a Fastify error string can name internals.
     */
    const frameworkStatus = (exception as { statusCode?: unknown })?.statusCode;
    if (typeof frameworkStatus === 'number' && frameworkStatus >= 400 && frameworkStatus < 500) {
      this.logger.warn('Requisição recusada pelo framework', {
        statusCode: frameworkStatus,
        code: (exception as { code?: string })?.code,
        path: request.url,
        method: request.method,
      });
      response.status(frameworkStatus).send({
        statusCode: frameworkStatus,
        message: 'Requisição inválida.',
      });
      return;
    }

    /**
     * Anything else → generic 500 + fire-and-forget report (never leaks internals).
     *
     * The fields are pulled out ONE BY ONE rather than logging `exception` directly, and that is not
     * cosmetic: `Error` has no enumerable own properties, so `JSON.stringify(new Error('x'))` is `{}`.
     * Logging the object produced a line that said an unhandled exception occurred and nothing about
     * what it was — the worst possible log entry, because it looks like diagnostics while carrying none.
     */
    const error = exception as Error & { code?: string; detail?: string };
    this.logger.error('Unhandled exception', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
      path: request.url,
      method: request.method,
    });

    try {
      this.reporter.report({
        exceptionType: (exception as Error)?.name ?? 'UnknownError',
        message: (exception as Error)?.message ?? 'unknown',
        stack: (exception as Error)?.stack,
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
