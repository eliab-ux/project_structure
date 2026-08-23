# 09_Veertex_Can.md — Módulo CAN (Canais de venda)

> **Versão reescrita a partir da FONTE-MÃE** (handoff: hub de canais, fatia 8 do
> levantamento) e do **código real do sistema anterior** (integra Mercado Livre, Shopee e
> Bling-como-hub — referência de fluxo, não de arquitetura). Substitui o esqueleto; os
> §2.1–§2.5 dele (variações como pré-requisito, pedido é do VND, estoque é do EST,
> port por canal, entrada não confiável) ficam RATIFICADOS integralmente.
> Último módulo da V1 por decisão ✓. Dependências: `CAN → VND + EST` (+ variações).

## 1. Decisões fechadas (respondem §3.1–§3.8 do esqueleto)

### 1.1 Canais da V1 (§3.1)
**Um adapter primeiro, provando o port** ✓ — e o escolhido é o **Mercado Livre**
(decisão de levantamento: maior retorno/menor atrito; e é o canal do sistema anterior —
o código real serve de mapa de API). Sequência registrada: **Meli → Shopee (fase 2) →
Instagram/Meta catálogo (fase 2)**. Loja virtual própria/vitrine do representante: fora
do CAN (onda futura própria). `SalesChannelPort` + `channel` com credenciais OAuth por
conta (cifradas), N canais ativos.

### 1.2 Direção da sincronização (§3.2)
**Produto/anúncio e preço: SAÍDA apenas na V1** ✓ (bidirecional descartado). **Estoque:
saída** (publica disponibilidade). **Pedido: entrada.** Publicação é por **anúncio**
(`channel_listing`): mapeamento produto↔anúncio com título/atributos próprios do canal,
status de sync e erro visível — inclui o widget "compatibilidade com canais" já previsto
no Produto (validação de completude POR canal).

### 1.3 Mapeamento de SKU (§3.3)
De-para no `channel_listing` (id externo por canal). **Pedido com SKU desconhecido entra
PENDENTE e aparece na Mesa como proposta de vínculo** ✓ (recusar perde venda —
ratificado; é também o comportamento correto para o payload bruto guardado).

### 1.4 Reserva e sobrevenda (§3.4)
O canal **aponta para uma LOCALIZAÇÃO de estoque** (03A) e publica o **disponível dela**
(descontadas reservas ativas) — decisão de levantamento (o sistema de referência mapeia
depósito↔canal; nós já temos a dimensão). Sync de estoque **por evento** (movimento/
reserva dispara job BullMQ) + reconciliação periódica. Cota fixa por canal: fase 2.

### 1.5 Pedido importado (§3.5) — a exceção explícita
**Entra `confirmado`** (já é venda paga no canal), **reservando estoque** — com a exceção
à regra de aprovação humana **declarada e delimitada**: a "aprovação" ocorreu no canal
(pagamento); o que fica pendente na Mesa são só os casos com problema (SKU desconhecido,
sem saldo, dados incompletos → `on_hold` com proposta de resolução). Idempotência dura:
`UNIQUE (channel, external_order_id)`; payload bruto guardado para auditoria/reprocesso.
Dados do comprador criam/vinculam contato (tipo customer) com `origin='externo'` —
disciplina de entrada não confiável ✓.

### 1.6 Preço por canal (§3.6)
**`price_list` do VND vinculada ao canal** (correção do 02A: tabela de preço é do VND,
multi-canal por design — "Tabela Mercado Livre" com a comissão do canal embutida).
Resolução: preço do anúncio = price_list do canal → fallback preço base.

### 1.7 Cancelamento/devolução vindos do canal (§3.7)
Cancelamento antes da NF: desfaz reserva e cancela o pedido (VND). Depois da NF:
operação fiscal (FIS) — fluxo coordenado, proposto na Mesa quando exigir decisão.
Devolução completa do marketplace: junto da reversa (V2).

### 1.8 Comissão/tarifa do canal (§3.8)
**V1 registra** a taxa informada pelo canal no pedido importado (campo no pedido +
lançamento de despesa no FIN com categoria própria) — é insumo direto da "margem real por
venda" do levantamento. Conciliação fina de repasses: fase 2.

## 2. Pré-requisito confirmado: variações de produto
Fatia do PRODUTO (CORE), não do CAN ✓ — destravar antes do adapter: `variant` com
atributos (cor/tamanho), SKU/GTIN próprios, participação em estoque e pedido.

## 3. Entidades (conceitual)

`channel` (tipo, conta OAuth cifrada, price_list_id, stock_location_id, status) ·
`channel_listing` (produto/variação ↔ anúncio: id externo, título, atributos, status
sync, erro) · `channel_order` (id externo, payload bruto, status de importação,
pedido interno) · `channel_sync_log` (append-only) · jobs BullMQ (push estoque/preço,
pull/webhook pedidos).

## 4. Ordem de fatias

1. Variações de produto (pré-requisito, fatia do CORE/Produto).
2. `channel` + `SalesChannelPort` + OAuth Meli + `channel_listing` (publicação manual
   de anúncio a partir do produto, com validação de completude por canal).
3. Entrada de pedidos (webhook + polling de segurança) → pedido VND `confirmado`,
   pendências na Mesa, idempotência.
4. Push de estoque (por evento + reconciliação) e preço (price_list do canal).
5. Taxa do canal no FIN; cancelamento coordenado.

## 5. Critérios de aceite

Os 6 do esqueleto RATIFICADOS (dependências; pedido único do VND; SKU desconhecido vira
pendência; disponibilidade respeita reservas; zero `if (canal===...)` fora de adapter;
zero violações) + 3 novos: (7) mesmo pedido notificado duas vezes importa UMA vez;
(8) pedido importado sem saldo entra `on_hold` com proposta na Mesa — nunca reserva
negativa silenciosa; (9) anúncio com produto incompleto para o canal é bloqueado com a
lista do que falta (widget de completude por canal).
