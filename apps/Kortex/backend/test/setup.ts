import { Logger } from '@nestjs/common';

/**
 * O código sob teste loga de propósito (tentativa de autenticação, no-show, start recusado).
 * Manter essa saída na rodada de testes soterra o resultado, então o logger é silenciado aqui.
 *
 * Teste que afirma sobre comportamento de log espiona o Logger por conta própria e continua
 * funcionando.
 */
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
