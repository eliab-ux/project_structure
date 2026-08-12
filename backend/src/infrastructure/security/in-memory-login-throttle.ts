import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginThrottlePort } from '../../contexts/auth/application/ports/output/login-throttle.port';
import { TooManyLoginAttemptsException } from '../../contexts/auth/domain/exceptions/auth-exceptions';

interface CredentialState {
  failures: number;
  lastFailureAt: number;
}

interface IpState {
  failures: number;
  windowStartedAt: number;
}

/**
 * As duas camadas do `LoginThrottlePort`, em memória do processo.
 *
 * **Por que em memória, e não numa tabela.** Duas razões, e a segunda é a que decide:
 *
 *  1. Um contador compartilhado exigiria Redis ou tabela nova. Redis é dependência nova; tabela nova
 *     é mudança de modelo de dados. As duas estão fora do que se decide sem consultar.
 *  2. **Estado em memória não pode ser desfeito por rollback.** É exatamente o defeito do ADR-0004:
 *     o contador de tentativas do reset de senha era gravado no banco e a exceção que sinalizava a
 *     falha derrubava a transação, apagando o incremento. Aqui o problema não existe por construção —
 *     nenhuma transação toca este estado. As três regras do ADR-0004 são satisfeitas assim: a regra 1
 *     (sobreviver ao rollback) por não depender de transação; a regra 2 (incremento atômico) porque o
 *     event loop do Node serializa o `+= 1`, sem leitura-e-escrita concorrente; e a regra 3 (falhar
 *     fechado) porque, na dúvida, o atraso é aplicado.
 *
 * **O que isto NÃO protege, e é honesto dizer:**
 *
 *  - **Múltiplas réplicas multiplicam a folga.** Com N processos, o teto por IP vira N × o teto, e o
 *    atraso de uma credencial é contado por processo. Hoje o Veertex roda em um container só, então o
 *    efeito é nulo; no dia em que houver a segunda réplica, esta implementação precisa virar
 *    armazenamento compartilhado — ver o gatilho de revisão no ADR-0004.
 *  - **Restart zera tudo.** Um atacante que conseguisse derrubar o processo reiniciaria os contadores.
 *    Quem consegue derrubar o processo tem problemas maiores à disposição.
 *
 * O port existe justamente para que a troca por armazenamento compartilhado não toque o Use Case.
 */
@Injectable()
export class InMemoryLoginThrottle implements LoginThrottlePort {
  private readonly logger = new Logger(InMemoryLoginThrottle.name);

  private readonly credentials = new Map<string, CredentialState>();
  private readonly ips = new Map<string, IpState>();

  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly ipFailureLimit: number;
  private readonly ipWindowMs: number;
  /** Depois deste silêncio, a escada da credencial recomeça do zero. */
  private readonly credentialResetMs: number;

  constructor(config: ConfigService) {
    this.baseDelayMs = Number(config.get('LOGIN_DELAY_BASE_MS') ?? 1000);
    this.maxDelayMs = Number(config.get('LOGIN_DELAY_MAX_MS') ?? 8000);
    this.ipFailureLimit = Number(config.get('LOGIN_IP_FAILURE_LIMIT') ?? 50);
    this.ipWindowMs = Number(config.get('LOGIN_IP_WINDOW_MS') ?? 5 * 60_000);
    this.credentialResetMs = Number(config.get('LOGIN_DELAY_RESET_MS') ?? 15 * 60_000);
  }

  assertIpWithinLimit(ip: string | null): void {
    if (!ip) {
      // Sem IP não há como aplicar a camada 1. Não é motivo para recusar: a camada 2 continua
      // valendo, e recusar deixaria o login inacessível a qualquer chamador sem IP resolvido.
      return;
    }

    const state = this.ips.get(ip);
    const now = this.now();

    if (!state || now - state.windowStartedAt >= this.ipWindowMs) {
      return;
    }

    if (state.failures >= this.ipFailureLimit) {
      // Sem e-mail no log: o que importa aqui é a origem, e registrar o e-mail tentado transformaria
      // o log numa lista de credenciais varridas.
      this.logger.warn('Teto de falhas de login por IP atingido', { ip, failures: state.failures });
      throw new TooManyLoginAttemptsException();
    }
  }

  delayForCredential(email: string): number {
    const state = this.credentials.get(this.key(email));
    if (!state) {
      return 0;
    }

    if (this.now() - state.lastFailureAt >= this.credentialResetMs) {
      return 0;
    }

    // 1ª falha → 1s, 2ª → 2s, 3ª → 4s, 4ª → 8s, e o teto a partir daí.
    const delay = this.baseDelayMs * 2 ** (state.failures - 1);
    return Math.min(delay, this.maxDelayMs);
  }

  registerFailure(email: string, ip: string | null): void {
    const now = this.now();

    const key = this.key(email);
    const current = this.credentials.get(key);
    const expired = current && now - current.lastFailureAt >= this.credentialResetMs;
    this.credentials.set(key, {
      failures: expired || !current ? 1 : current.failures + 1,
      lastFailureAt: now,
    });

    if (!ip) {
      return;
    }
    const ipState = this.ips.get(ip);
    if (!ipState || now - ipState.windowStartedAt >= this.ipWindowMs) {
      this.ips.set(ip, { failures: 1, windowStartedAt: now });
      return;
    }
    ipState.failures += 1;
  }

  registerSuccess(email: string): void {
    this.credentials.delete(this.key(email));
  }

  /**
   * Normalizada, porque `Maria@X.com` e `maria@x.com` são a mesma credencial — e sem isto trocar a
   * caixa de uma letra zeraria o atraso, o que é o mesmo que não ter atraso.
   */
  private key(email: string): string {
    return (email ?? '').trim().toLowerCase();
  }

  private now(): number {
    return Date.now();
  }
}
