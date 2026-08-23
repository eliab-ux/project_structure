export const WALLET_TITLE_LOOKUP = Symbol('WALLET_TITLE_LOOKUP');

/** O que a montagem da carteira precisa de um título candidato (§3.4 do 04). */
export interface WalletTitleInfo {
  titleId: string;
  contactId: string;
  /** Saldo em aberto do título no momento da consulta. */
  openAmount: number;
  status: string;
}

/**
 * Títulos candidatos à carteira de uma viagem: a receber, origem consignação, em aberto
 * (open/partial), de contatos CARTEIRIZADOS na rota. O adapter faz o join contatos(route_id) ×
 * títulos; o escopo de tenant + RLS escopam.
 */
export interface WalletTitleLookupPort {
  findOpenConsignmentTitlesByRoute(routeId: string): Promise<WalletTitleInfo[]>;
}
