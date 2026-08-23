export const CONTACT_GEO = Symbol('CONTACT_GEO');

/**
 * Propaga o GPS do pedido ao CADASTRO da revendedora (§3.1 do 04: o GPS da abertura é "propagado ao
 * cadastro"). O ROT não conhece o agregado Contact — só declara a necessidade; o adapter da
 * persistência preenche as coordenadas do endereço.
 *
 * `overwrite=false` (captura da abertura): preenche só se o cadastro ainda não tem coordenada — a
 * primeira visita georreferencia o cliente, mas nunca sobrescreve o que já existe.
 * `overwrite=true` (alteração explícita auditada do ChangeOrderGps): corrige o cadastro junto — o
 * ponto anterior estava errado, e deixá-lo no cadastro perpetuaria o erro que a ação corrigiu.
 */
export interface ContactGeoPort {
  applyOrderGps(params: {
    contactId: string;
    latitude: number;
    longitude: number;
    overwrite: boolean;
  }): Promise<void>;
}
