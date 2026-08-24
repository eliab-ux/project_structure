export const CONTACT_OVERDUE_LOOKUP = Symbol('CONTACT_OVERDUE_LOOKUP');

/**
 * Bloqueio por inadimplência (06 §2.5): o VND pergunta se o contato tem título a receber vencido
 * além de N dias — sem depender do módulo FIN inteiro (mesmo desenho dos demais lookups). O
 * adapter lê os títulos; a decisão (preferência da conta + override por permissão) é do use case.
 */
export interface ContactOverdueLookupPort {
  /** Soma em aberto dos títulos a receber do contato vencidos há MAIS de `olderThanDays` dias. */
  overdueAmount(contactId: string, olderThanDays: number, now: Date): Promise<number>;
}
