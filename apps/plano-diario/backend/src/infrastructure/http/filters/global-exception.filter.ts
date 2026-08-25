import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { DomainException } from '@gitspread/domain-primitives';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ErrorReporterPort } from '../../observability/ports/error-reporter.port';

/**
 * Ponto único de tratamento de falha (Fail Securely). O cliente só recebe mensagem genérica
 * em erro inesperado; stack trace e detalhes de infraestrutura ficam no log interno.
 *
 * Só 500 / exceção inesperada é reportado ao ERROR_REPORTER — nunca 4xx esperado
 * (regra de negócio, validação, not found, forbidden).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // DomainException → a mensagem de negócio é segura de expor. O status segue a semântica
    // codificada no nome da exceção: *NotFound* → 404, *InvalidCredentials*/*Unauthorized* → 401,
    // *Unavailable* → 503, qualquer outra → 400.
    if (exception instanceof DomainException) {
      const name = exception.constructor?.name ?? '';
      let status = 400;
      if (/NotFound/i.test(name)) {
        status = 404;
      } else if (/InvalidCredentials|Unauthorized/i.test(name)) {
        status = 401;
      } else if (/Unavailable/i.test(name)) {
        // Falha do servidor, não do pedido: 400 faria o usuário procurar erro no que ele digitou.
        status = 503;
      }
      response.status(status).send({ statusCode: status, message: exception.message });
      return;
    }

    // HttpException do NestJS → repassa status e mensagem controlada
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(exception.getResponse());
      return;
    }

    // Qualquer outro erro → 500 genérico + reporte fire-and-forget (nunca vaza internals)
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
      // Uma falha de monitoramento jamais pode gerar uma segunda exceção que mascare a original.
    }

    response.status(500).send({ statusCode: 500, message: 'Erro interno. Tente novamente.' });
  }
}
