export const CONSIGNMENT_FISCAL = Symbol('CONSIGNMENT_FISCAL');

export interface ConsignmentFiscalLine {
  productId: string;
  quantity: number;
}

/**
 * Fronteira ROT↔FIS (§2 do 07, §3.1–§3.2 do 04) — os TRÊS pontos em que a consignação emite
 * documento fiscal quando o FIS existir. As naturezas de operação são as do 07 §1.3:
 *
 *  - **carga** → `remessa em consignação`;
 *  - **acerto (pagou)** → `venda de mercadoria consignada`;
 *  - **devolução no acerto** → `retorno de consignação`.
 *
 * O ROT informa só a operação e as linhas — CFOP **nunca** é campo do ROT (derivado pela matriz do
 * FIS: natureza × UF × destinatário). **Sem FIS ativo, o adapter é no-op e devolve `null`**: a
 * consignação opera SEM documento fiscal (fronteira declarada — o FIS é módulo opcional por conta).
 * Trocar o provider quando o FIS entrar; nenhuma assinatura muda.
 */
export interface ConsignmentFiscalPort {
  /** Carga da viagem (warehouse → rep_load): remessa em consignação. */
  emitConsignmentShipment(request: {
    tripId: string;
    companyId: string;
    fromLocationId: string;
    toLocationId: string;
    lines: ConsignmentFiscalLine[];
  }): Promise<string | null>;

  /** Acerto — item pago: venda de mercadoria consignada. */
  emitConsignedSale(request: {
    tripId: string;
    orderId: string;
    contactId: string;
    companyId: string;
    lines: ConsignmentFiscalLine[];
  }): Promise<string | null>;

  /** Acerto — item devolvido: retorno de consignação. */
  emitConsignmentReturn(request: {
    tripId: string;
    orderId: string;
    companyId: string;
    lines: ConsignmentFiscalLine[];
  }): Promise<string | null>;
}
