import { CustomerCredit } from '../../../domain/entities/customer-credit.entity';

export const CUSTOMER_CREDIT_REPOSITORY = Symbol('CUSTOMER_CREDIT_REPOSITORY');

/**
 * Créditos do cliente (05 §2.5) — port pronto, fluxo DORMENTE até o FIS: quem grava é a devolução
 * coordenada (02 §3.8); quem consome é a baixa de título futuro. Nada disso existe ainda — o port
 * nasce para o dia da devolução ser plug, não refatoração.
 */
export interface CustomerCreditRepositoryPort {
  findById(id: string): Promise<CustomerCredit | null>;
  /** Créditos ABERTOS de um contato — o que uma baixa futura pode consumir. */
  listOpenByContact(contactId: string): Promise<CustomerCredit[]>;
  save(credit: CustomerCredit): Promise<CustomerCredit>;
}
