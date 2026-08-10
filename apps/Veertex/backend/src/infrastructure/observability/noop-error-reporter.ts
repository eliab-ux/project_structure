import { Injectable } from '@nestjs/common';
import { ErrorReporterPort, ErrorScenario } from './ports/error-reporter.port';

/**
 * Default reporter: no monitoring tool configured → does nothing. That is not an error, it is the
 * expected state until the VEXGuard exists.
 */
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  report(_scenario: ErrorScenario): void {
    // intentionally empty
  }
}
