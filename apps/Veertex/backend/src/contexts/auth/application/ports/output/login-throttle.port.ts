export const LOGIN_THROTTLE = Symbol('LOGIN_THROTTLE');

/**
 * As duas camadas que protegem o login de força bruta.
 *
 * **Camada 1 — teto por IP.** É de onde a força bruta vem: um atacante varre milhares de senhas de
 * uma origem. Conta apenas FALHAS, e com folga deliberada — num varejo, todos os terminais de PDV de
 * uma loja saem pelo MESMO IP público, e um teto apertado tiraria a loja inteira do ar por causa de
 * alguns operadores digitando senha errada. Recusar por IP é a única recusa dura do desenho, e é
 * segura contra enumeração porque não depende de qual e-mail foi tentado.
 *
 * **Camada 2 — atraso progressivo por credencial.** 1s, 2s, 4s, 8s, com teto. **Atraso, e não
 * bloqueio.** DECIDIDO (Eliab, 11/08/2026): bloqueio duro é vetor de negação de serviço — quem
 * souber o e-mail de um operador o tranca sem acertar senha nenhuma, e num ERP com PDV isso é caixa
 * parado no expediente. O atraso encarece a varredura sem nunca impedir o dono da conta de entrar.
 *
 * A chave da camada 2 é o **e-mail submetido**, não o id do usuário, e isso é exigência de segurança
 * e não conveniência: um e-mail inexistente tem de acumular exatamente o mesmo atraso que um
 * existente. Se só contas reais atrasassem, a diferença de tempo diria quais e-mails existem — e o
 * desenho todo do login (mesma exceção, mesma mensagem, comparação contra hash falso para igualar o
 * tempo) existe justamente para não dizer isso.
 */
export interface LoginThrottlePort {
  /**
   * Lança `TooManyLoginAttemptsException` se este IP passou do teto de falhas na janela.
   *
   * Chamado ANTES de qualquer trabalho — é a recusa mais barata possível, e é o ponto do teto.
   */
  assertIpWithinLimit(ip: string | null): void;

  /**
   * Quanto tempo esperar antes de processar esta tentativa, em milissegundos.
   *
   * Devolve o atraso acumulado pelas falhas anteriores DESTA credencial. Zero na primeira tentativa.
   */
  delayForCredential(email: string): number;

  /** Registra a falha nas duas camadas. */
  registerFailure(email: string, ip: string | null): void;

  /** Zera o atraso da credencial. O teto por IP permanece — sucesso não perdoa a varredura. */
  registerSuccess(email: string): void;
}
