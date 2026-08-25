import { Global, Module } from '@nestjs/common';
import { ERROR_REPORTER } from './ports/error-reporter.port';
import { NoopErrorReporter } from './noop-error-reporter';

@Global()
@Module({
  providers: [{ provide: ERROR_REPORTER, useClass: NoopErrorReporter }],
  exports: [ERROR_REPORTER],
})
export class ObservabilityModule {}
