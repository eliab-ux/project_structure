# 08_Veertex_Exp.md — Módulo EXP (Expedição)

> **Versão reescrita a partir da FONTE-MÃE** (handoff: logística fechada em 16 pontos —
> doc `Levantamento_Logistica_Frete.md`, a adicionar ao repo — + decisões D1/D2) e do
> **código real do sistema anterior** (Nexo/"Veertex Lovable": Vite+Supabase com
> `mercadolivre.server.ts`, `shopee.server.ts`, `bling.server.ts`, `nfe.server.ts` — o
> Eliab disponibiliza a pasta ao agente na fatia; a lição registrada dele: **CFOP estava
> em configuração — erro a NÃO repetir**, regra já no FIS §2.4).
> Substitui o esqueleto; a pergunta §1.1 dele está respondida abaixo.

## 1. Escopo (resposta ao §1.1 do esqueleto)

A **cotação** saiu para o `FreightQuotePort` do VND (decidido ✓). O EXP é **o pipeline
pós-faturamento do envio**:

**fila de pedidos a expedir → separação/conferência → volumes/embalagem → etiqueta →
despacho (remessa/pré-postagem) → rastreio → entregue.**

Fora do EXP: rota de venda (ROT), rotas de ENTREGA própria com otimização de paradas e
POD (módulo **ENT**, onda futura — o papel Entregador pertence a lá; resposta ao §3.5) e
**logística reversa** (V2, decisão fechada). Etiqueta gerada pelo marketplace (ML
Full/Flex, Shopee): **V2** (decisão fechada) — na V1 o CAN importa o pedido e o EXP trata
como envio próprio quando aplicável.

## 2. Decisões fechadas (do levantamento de logística)

1. **Provedores (D1):** Correios contrato direto (PPN) **E** agregador de frete
   **simultâneos** — `ShippingProviderPort` com **matriz de capabilities por adapter**
   (agregador sem PPN/ZPL; Correios direto não cota outras transportadoras); N
   instâncias por CNPJ; credenciais com **botão Testar** (health check — convenção da
   casa, mesma do certificado/SEFAZ).
2. **Volumes (resposta §3.3): SIM na V1** — pedido → N volumes → itens por volume;
   **cadastro de embalagens padrão** (caixa P/M/G com dimensões/peso) para agilizar;
   cubagem = modelo Bling (dimensões do produto; maior entre peso real e cubado).
3. **Etiqueta:** PDF e **ZPL** (térmica — subsistema de impressão compartilhado com a
   promissória do ROT); **geração em LOTE** (selecionar N pedidos → imprimir tudo).
4. **Remessa/pré-postagem:** disparo na expedição, **idempotente** ("ignora objetos já
   enviados"), ajuste automático de campos aos limites do parceiro.
5. **Rastreio (resposta §3.4):** integração pelos provedores (não manual): **enum
   interno normalizado** de status + tabela de tradução por provedor; sync por worker
   (BullMQ — mesmo gatilho da geocodificação); **página de rastreio white-label** +
   notificações automáticas por movimentação via engine de notificação (e-mail/WhatsApp).
6. **Financeiro dos provedores:** carteira pré-paga do agregador (saldo visível; cada
   etiqueta = despesa) × fatura mensal Correios (acúmulo + conciliação) — lançamentos no
   FIN com categoria de frete.
7. **Relação com EST (resposta §3.2):** a baixa é do **faturamento** (decidido no 02);
   a expedição **não baixa estoque** — ela executa a saída física do que já foi baixado.
   Estados do pedido no EXP são próprios (`awaiting_fulfillment → picking → packed →
   shipped → delivered`, + `on_hold`), paralelos e vinculados à situação do VND.
8. **Conferência de separação:** por lista na V1 (bipagem por código de barras: fase 2
   nomeada). Divergência na separação gera pendência visível, nunca ajuste silencioso.
9. **Comprovante (resposta §3.6):** para envio por transportadora, o comprovante é o
   rastreio "entregue" do provedor; POD próprio (foto/assinatura/GPS) pertence ao ENT.
10. **Conciliação frete cotado × real:** diferença vira lançamento no FIN (categoria
    fretes) — fecha o ciclo com o snapshot da cotação gravado no pedido (D2).

## 3. Entidades (conceitual)

`shipment` (pedido, empresa, provedor/serviço, status normalizado, códigos externos,
rastreio) · `shipment_volume` (+itens) · `package_template` (embalagens padrão) ·
`shipping_provider_config` (por CNPJ, credenciais cifradas, capabilities, teste) ·
`tracking_event` (append-only, traduzido) · `label` (pdf/zpl keys no MinIO).

## 4. Ordem de fatias

1. Analisar o código do sistema anterior (pasta fornecida pelo Eliab) — extrair fluxos e
   ERRATA de configuração; relatório curto antes de codificar.
2. Fila + estados do shipment + volumes/embalagens.
3. `ShippingProviderPort` + 1º adapter (agregador OU Correios — decidir pelo contrato
   real disponível do Eliab) + etiqueta PDF/ZPL + lote.
4. Rastreio: enum normalizado, worker de sync, página white-label, notificações.
5. Segundo adapter (completa D1) + financeiro dos provedores no FIN.

## 5. Critérios de aceite

1. Pedido faturado com `delivery_mode=envio` entra na fila automaticamente.
2. Volume obrigatório antes da etiqueta; etiqueta em lote funciona para N pedidos.
3. Remessa idempotente: reenviar não duplica objeto no provedor.
4. Status de rastreio de dois provedores diferentes convergem para o mesmo enum interno.
5. Expedição não altera saldo de estoque (por teste — a baixa já ocorreu no faturamento).
6. `verify:isolation` cobre as tabelas novas; zero violações do `CLAUDE.md`.
