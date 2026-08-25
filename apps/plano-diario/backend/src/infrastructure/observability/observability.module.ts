import { Global, Module } from '@nestjs/common';
import { NoopErrorReporter } from './noop-error-reporter';
import { ERROR_REPORTER } from './ports/error-reporter.port';

@Global()
@Module({
  providers: [{ provide: ERROR_REPORTER, useClass: NoopErrorReporter }],
  exports: [ERROR_REPORTER],
})
export class ObservabilityModule {}
