import { ArgumentsHost, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { DomainException } from '@gitspread/domain-primitives';
import { GlobalExceptionFilter } from '../../../../src/infrastructure/http/filters/global-exception.filter';
import {
  ErrorReporterPort,
  ErrorScenario,
} from '../../../../src/infrastructure/observability/ports/error-reporter.port';

class AccountNotFoundException extends DomainException {
  constructor() {
    super('Conta não encontrada');
  }
}

class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Credenciais inválidas');
  }
}

class QuotaExceededException extends DomainException {
  constructor() {
    super('Cota do canal excedida');
  }
}

function buildHost(): { host: ArgumentsHost; send: jest.Mock; status: jest.Mock } {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/channels', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, send, status };
}

describe('GlobalExceptionFilter', () => {
  let reporter: ErrorReporterPort & { report: jest.Mock };
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    reporter = { report: jest.fn() };
    filter = new GlobalExceptionFilter(reporter);
    // The filter is supposed to log the unexpected error; keep the test output readable.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a business DomainException to 400 and exposes its message', () => {
    const { host, status, send } = buildHost();

    filter.catch(new QuotaExceededException(), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ statusCode: 400, message: 'Cota do canal excedida' });
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('maps a *NotFound* DomainException to 404', () => {
    const { host, status } = buildHost();

    filter.catch(new AccountNotFoundException(), host);

    expect(status).toHaveBeenCalledWith(404);
  });

  it('maps an *InvalidCredentials* DomainException to 401', () => {
    const { host, status } = buildHost();

    filter.catch(new InvalidCredentialsException(), host);

    expect(status).toHaveBeenCalledWith(401);
  });

  it('forwards the status of a NestJS HttpException without reporting it', () => {
    const { host, status } = buildHost();

    filter.catch(new NotFoundException('Canal não encontrado'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('does not report an expected 403', () => {
    const { host, status } = buildHost();

    filter.catch(new ForbiddenException(), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it('answers a generic 500 for an unexpected error and leaks no internals', () => {
    const { host, status, send } = buildHost();
    const boom = new Error('connect ECONNREFUSED 10.0.0.5:5432 — relation "channels" missing');

    filter.catch(boom, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Erro interno. Tente novamente.',
    });
    const payload = JSON.stringify(send.mock.calls[0][0]);
    expect(payload).not.toContain('ECONNREFUSED');
    expect(payload).not.toContain('channels');
  });

  it('reports the unexpected error scenario (fire-and-forget)', () => {
    const { host } = buildHost();

    filter.catch(new TypeError('cannot read property of undefined'), host);

    expect(reporter.report).toHaveBeenCalledTimes(1);
    const scenario = reporter.report.mock.calls[0][0] as ErrorScenario;
    expect(scenario.exceptionType).toBe('TypeError');
    expect(scenario.method).toBe('GET');
    expect(scenario.path).toBe('/api/channels');
    expect(scenario.occurredAt).toBeDefined();
  });

  it('still answers 500 when the reporter itself throws', () => {
    const { host, status } = buildHost();
    reporter.report.mockImplementation(() => {
      throw new Error('monitoring down');
    });

    expect(() => filter.catch(new Error('boom'), host)).not.toThrow();
    expect(status).toHaveBeenCalledWith(500);
  });
});
