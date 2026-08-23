/**
 * Origem do pedido — enum CANÔNICO do levantamento (Visão Geral §2, ratificado no 02A §3.1).
 *
 * `erp` (retaguarda), `pdv` (balcão/PDV), `rota` (representante em viagem), `vitrine` (loja virtual,
 * futura) e `marketplace`. Enum **aberto** (como o `format` do produto): `vitrine`/`marketplace`
 * entram quando o CAN existir — o valor não é recusado antes, evitando migração de enum.
 *
 * Mapeamento dos valores antigos (§3.1 do 02A), aplicado na migration:
 * `balcao→pdv`, `representante→rota`, `telefone→erp`, `importacao→erp`. A granularidade fina que se
 * perde vai para o campo livre `origin_detail`.
 */
export const ORDER_ORIGINS = ['erp', 'pdv', 'rota', 'vitrine', 'marketplace'] as const;

export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

export const ORDER_ORIGIN_LABEL: Record<string, string> = {
  erp: 'ERP',
  pdv: 'PDV',
  rota: 'Rota',
  vitrine: 'Vitrine',
  marketplace: 'Marketplace',
};

/**
 * Modo de entrega (§3.1 do 02A) — ausente no 02, incluído aqui. `retirada` (cliente retira),
 * `envio` (transportadora/correio) e `rota_entrega` (entrega na rota do representante). Default
 * `retirada`: o pedido de balcão, o caso mais comum, não exige logística.
 */
export const DELIVERY_MODES = ['retirada', 'envio', 'rota_entrega'] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  retirada: 'Retirada',
  envio: 'Envio',
  rota_entrega: 'Entrega na rota',
};

export const DEFAULT_DELIVERY_MODE: DeliveryMode = 'retirada';
