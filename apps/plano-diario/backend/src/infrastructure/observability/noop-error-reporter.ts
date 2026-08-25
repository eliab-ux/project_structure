import { Injectable } from '@nestjs/common';
import { ErrorReporterPort, ErrorScenario } from './ports/error-reporter.port';

/**
 * Reporter default: sem ferramenta de monitoramento configurada → não faz nada.
 * Isso não é erro. Quando o `<NomeDoGuard>` existir, troca-se apenas este provider.
 */
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  report(_scenario: ErrorScenario): void {
    // intencionalmente vazio
  }
}
