import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';

/**
 * Makes a rejected webhook payload LOUD, and answers 200 anyway.
 *
 * The hole this closes cost days. The global `ValidationPipe` runs with `forbidNonWhitelisted: true`, so
 * a payload that does not match the DTO is refused BEFORE the controller — which means before any
 * application log. The provider received a 400, quietly stopped trying, and from the operator's side it
 * looked exactly like "nobody replied". Nothing in the log said otherwise, because from the application's
 * point of view the call never happened.
 *
 * Two decisions, and they pull in opposite directions on purpose:
 *
 *  1. **Log it at ERROR, with the reason.** A payload we cannot parse is our problem to fix, and it has
 *     to be visible the moment it happens rather than deduced from an absence weeks later.
 *  2. **Answer 200 regardless.** A 4xx teaches the provider to give up on the whole webhook, and losing
 *     every future event because of one malformed one is a far worse outcome than dropping that one. The
 *     event is lost either way — there is no history import to recover it from — so the only thing left
 *     worth protecting is the channel staying open.
 *
 * Answering 200 to something we refused would be dishonest if it were silent. It is not silent: that is
 * precisely what item 1 is for.
 */
@Catch(BadRequestException)
export class WebhookPayloadRejectionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebhookPayloadRejectionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const detail = WebhookPayloadRejectionFilter.describe(exception);

    this.logger.error(
      `Payload de webhook RECUSADO pela validação — ${detail}. ` +
        'O evento foi perdido. Respondendo 200 para a Evolution não desistir do webhook.',
    );

    response.status(200).send({ received: false });
  }

  /** The validation messages, flattened — never the payload itself, which may carry message content. */
  private static describe(exception: BadRequestException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.map((entry) => String(entry)).join('; ');
    }
    return String(message ?? exception.message);
  }
}
