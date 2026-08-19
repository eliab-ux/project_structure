export const SUPPLIER_LOOKUP = Symbol('SUPPLIER_LOOKUP');

export interface SupplierInfo {
  /** O nome de exibição do contato — usado no DTO para a tela não buscar cada um. */
  name: string;
  /** O contato tem o tipo `supplier`? */
  isSupplier: boolean;
}

/**
 * O que o Produto precisa saber sobre CONTATOS — e nada além disso.
 *
 * ## Por que um port próprio, e não o repositório de contatos
 *
 * O Produto precisa de duas informações: *este contato existe e é fornecedor?* e *como ele se
 * chama?*. Injetar `CONTACT_REPOSITORY` aqui daria ao Produto acesso a `save`, `findByDocument` e
 * `list` — capacidade que ele não usa e não deveria ter (Princípio do Menor Privilégio do
 * `CLAUDE.md`). Um port com um método é a superfície mínima.
 *
 * O ganho concreto vem no dia em que alguém mexer no Contato: mudar a assinatura de `save` não toca
 * no Produto, porque o Produto nunca pediu `save`.
 *
 * ## Por que a consulta é em LOTE
 *
 * Um produto tem N fornecedores. Validar um por um faria N consultas para cada gravação e para cada
 * leitura — o problema clássico de N+1, aqui com N pequeno e frequência alta.
 */
export interface SupplierLookupPort {
  /**
   * Devolve informações dos contatos pedidos. **Contato inexistente simplesmente não aparece no
   * mapa** — ausência é a resposta, e o use case a traduz em exceção de negócio.
   *
   * O escopo de tenant não é parâmetro: vale o mesmo da requisição (filtro global + RLS), então um id
   * de outra conta não aparece no mapa, exatamente como um id que não existe.
   */
  findByIds(contactIds: readonly string[]): Promise<Map<string, SupplierInfo>>;
}
