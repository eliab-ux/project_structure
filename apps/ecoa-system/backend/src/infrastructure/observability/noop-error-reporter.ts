import { Injectable } from '@nestjs/common';
import { ErrorReporterPort, ErrorScenario } from './ports/error-reporter.port';

/**
 * Default reporter: no monitoring tool configured → does nothing. This is not an error.
 * When the `<NomeDoGuard>` exists, replace only the ERROR_REPORTER provider.
 */
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  report(_scenario: ErrorScenario): void {
    // intentionally empty
  }
}
