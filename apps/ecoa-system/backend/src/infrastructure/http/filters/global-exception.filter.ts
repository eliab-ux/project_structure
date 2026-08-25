import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DomainException } from '@gitspread/domain-primitives';
import { ErrorReporterPort } from '../../observability/ports/error-reporter.port';

/**
 * Single point of failure handling (Fail Securely). The client only ever receives a safe,
 * generic message for unexpected errors; stack traces and internals stay in the logs.
 *
 * Only genuine 500s / unexpected exceptions are reported to the ERROR_REPORTER —
 * never expected 4xx (domain rule, validation, not found, forbidden).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // DomainException → business message is safe to expose. The concrete status follows the
    // semantics encoded in the exception name (Fail Securely + correct HTTP contract):
    //   *NotFound* → 404, *InvalidCredentials*/*Unauthorized* → 401, everything else → 400.
    if (exception instanceof DomainException) {
      const name = exception.constructor?.name ?? '';
      let status = 400;
      if (/NotFound/i.test(name)) {
        status = 404;
      } else if (/InvalidCredentials|Unauthorized/i.test(name)) {
        status = 401;
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

    // Anything else → generic 500 + fire-and-forget report (never leaks internals)
    this.logger.error('Unhandled exception', {
      exception,
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
      // A monitoring failure must never produce a second exception masking the original.
    }

    // English: the app's default locale is English (see frontend `src/i18n/`).
    response.status(500).send({ statusCode: 500, message: 'Internal error. Please try again.' });
  }
}
