import { Injectable } from '@nestjs/common';
import { ErrorReporterPort, ErrorScenario } from './ports/error-reporter.port';

/**
 * Reporter padrão: nenhuma ferramenta de monitoramento configurada → não faz nada. Isso não é
 * erro. Quando o VEXGuard existir, só este provider muda.
 */
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  report(_scenario: ErrorScenario): void {
    // intencionalmente vazio
  }
}
