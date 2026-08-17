import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DomainException } from '@gitspread/domain-primitives';
import { ErrorReporterPort } from '../../observability/ports/error-reporter.port';

/**
 * Ponto único de tratamento de falha (Fail Securely). O cliente só recebe mensagem genérica em
 * erro inesperado; stack trace, SQL e detalhe de ORM ficam no log.
 *
 * Só 500 / exceção inesperada chega ao ERROR_REPORTER — nunca um 4xx esperado (regra de negócio,
 * validação, not found, forbidden).
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
    // codificada no nome da exceção:
    //   *NotFound* → 404, *InvalidCredentials*/*Unauthorized* → 401, *Forbidden* → 403,
    //   o resto → 400.
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

    // HttpException do NestJS → repassa status e mensagem controlada.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).send(exception.getResponse());
      return;
    }

    /**
     * Erro de framework que JÁ se classificou como erro do CLIENTE.
     *
     * O Fastify levanta estes antes de qualquer controller — body JSON malformado, body vazio com
     * `content-type: application/json`, payload acima do limite. Eles carregam `statusCode` na
     * faixa 4xx, e repassá-lo não é conveniência: reportar a requisição malformada de um cliente
     * como 500 diz a ele "o servidor está quebrado", manda-o procurar no lugar errado e polui o
     * error reporter com ruído que esconde falha de verdade.
     *
     * Só o CÓDIGO é repassado, nunca a mensagem: string de erro do Fastify pode nomear internals.
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
     * Qualquer outra coisa → 500 genérico + report fire-and-forget (nunca vaza internals).
     *
     * Os campos são extraídos UM A UM em vez de logar `exception` direto, e isso não é cosmético:
     * `Error` não tem propriedade própria enumerável, então `JSON.stringify(new Error('x'))` é
     * `{}`. Logar o objeto produzia uma linha que dizia que houve exceção não tratada e nada sobre
     * qual — a pior entrada de log possível, porque parece diagnóstico e não carrega nenhum.
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
        exceptionType: error?.name ?? 'UnknownError',
        message: error?.message ?? 'unknown',
        stack: error?.stack,
        method: request.method,
        path: request.url,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Falha de monitoramento jamais pode levantar uma segunda exceção que mascare a original.
    }

    response.status(500).send({ statusCode: 500, message: 'Erro interno. Tente novamente.' });
  }
}
