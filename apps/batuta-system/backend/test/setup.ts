import { Logger } from '@nestjs/common';

/**
 * The code under test logs on purpose (auth attempts, suspensions, refused dispatches). Keeping
 * that output in the test run buries the actual results, so the logger is silenced globally here.
 *
 * Tests that assert on logging behaviour spy on Logger themselves and still work.
 */
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
