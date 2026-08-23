export const PROMISSORY_DEBTOR_LOOKUP = Symbol('PROMISSORY_DEBTOR_LOOKUP');

/** O snapshot da devedora que a promissória imprime (§3.1 do 04). */
export interface PromissoryDebtorInfo {
  name: string;
  document: string | null;
}

export interface PromissoryDebtorLookupPort {
  findByContact(contactId: string): Promise<PromissoryDebtorInfo | null>;
}
