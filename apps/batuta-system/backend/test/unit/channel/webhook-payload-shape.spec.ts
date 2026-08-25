import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EvolutionWebhookRequestDto } from '../../../src/infrastructure/http/controllers/webhook/dto/evolution-webhook-request.dto';
import { WebhookPayloadRejectionFilter } from '../../../src/infrastructure/http/controllers/webhook/webhook-payload-rejection.filter';

const INSTANCE =
  'acct-11111111-1111-4111-8111-111111111111-ch-aaaaaaaa-1111-4111-8111-111111111111';

async function errorsFor(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(EvolutionWebhookRequestDto, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

/**
 * The trap this guards against.
 *
 * `data` used to be validated with `@IsObject()`, and class-validator's `isObject` REJECTS an array.
 * Evolution has shipped `messages.upsert` with `data` as an array in some versions of the v2 line — the
 * same drift that changed the body of `/webhook/set` mid-series. A rejected payload never reaches the
 * service, so it left NO application log: a 400 went back to the provider, which then quietly gave up,
 * and from the operator's side it was indistinguishable from "nobody replied".
 */
describe('EvolutionWebhookRequestDto — shape tolerance', () => {
  it('accepts `data` as an object', async () => {
    expect(
      await errorsFor({ event: 'messages.upsert', instance: INSTANCE, data: { key: {} } }),
    ).toEqual([]);
  });

  it('ACCEPTS `data` as an array — the shape that used to be refused', async () => {
    expect(
      await errorsFor({ event: 'messages.upsert', instance: INSTANCE, data: [{ key: {} }] }),
    ).toEqual([]);
  });

  it('accepts the full envelope Evolution actually sends', async () => {
    // Every known top-level key is declared, because `forbidNonWhitelisted` is global: an undeclared one
    // would refuse a legitimate call.
    expect(
      await errorsFor({
        event: 'messages.upsert',
        instance: INSTANCE,
        data: { key: { remoteJid: '5561999998888@s.whatsapp.net', fromMe: false } },
        destination: 'https://batuta.techbs.com.br/api/webhooks/evolution',
        date_time: '2026-08-10T15:55:26.000Z',
        sender: '5561991753858@s.whatsapp.net',
        server_url: 'https://evo2.techbs.com.br',
        apikey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      }),
    ).toEqual([]);
  });

  it('still refuses a call with no instance — the tenant comes from there and nowhere else', async () => {
    const errors = await errorsFor({ event: 'messages.upsert', data: {} });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('still refuses an unknown top-level key', async () => {
    const errors = await errorsFor({ event: 'x', instance: INSTANCE, algoEstranho: 'x' });

    expect(errors.join(' ')).toMatch(/algoEstranho/);
  });
});

describe('WebhookPayloadRejectionFilter', () => {
  function replySpy(): { status: jest.Mock; send: jest.Mock } {
    const reply = { status: jest.fn(), send: jest.fn() };
    reply.status.mockReturnValue(reply);
    return reply;
  }

  function hostWith(reply: unknown): Parameters<WebhookPayloadRejectionFilter['catch']>[1] {
    return {
      switchToHttp: () => ({ getResponse: () => reply }),
    } as unknown as Parameters<WebhookPayloadRejectionFilter['catch']>[1];
  }

  it('answers 200 so the provider does not give up on the whole webhook', () => {
    // A 4xx teaches Evolution to stop calling. Losing every future event because of one malformed
    // payload is far worse than losing that one — which is lost either way, there being no history import.
    const reply = replySpy();

    new WebhookPayloadRejectionFilter().catch(
      new BadRequestException({ message: ['data must be an object'] }),
      hostWith(reply),
    );

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ received: false });
  });

  it('logs the rejection at ERROR — answering 200 silently would be the actual dishonesty', () => {
    const reply = replySpy();
    const filter = new WebhookPayloadRejectionFilter();
    const logged: string[] = [];
    jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation((message: unknown) => void logged.push(String(message)));

    filter.catch(new BadRequestException({ message: ['data must be an object'] }), hostWith(reply));

    expect(logged.join(' ')).toMatch(/RECUSADO/);
    // The reason has to be in the line, or the log says "something was wrong" and nothing more.
    expect(logged.join(' ')).toMatch(/data must be an object/);
  });
});
