export const CUSTOMER_LOOKUP = Symbol('CUSTOMER_LOOKUP');

/** O que o VND precisa saber de um contato para vender a ele — nada além. */
export interface CustomerInfo {
  id: string;
  displayName: string;
  /** Limite de crédito (§2.2). `null` = sem limite definido → não bloqueia. */
  creditLimit: number | null;
  /** Vendedor vinculado (carteirização, §2.3) — reservado para o filtro por ator. */
  salesRepId: string | null;
  isCustomer: boolean;
  active: boolean;
}

/**
 * Lê o contato-cliente sem que o VND dependa do módulo de Contato — mesmo desenho do
 * `SupplierLookupPort` do Produto. Escopado pelo tenant (filtro global + RLS): id de outra conta não
 * vem, e o use case o trata como inexistente.
 */
export interface CustomerLookupPort {
  findById(contactId: string): Promise<CustomerInfo | null>;
}
