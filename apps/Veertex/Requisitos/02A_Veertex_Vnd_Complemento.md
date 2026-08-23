# 02A_Veertex_Vnd_Complemento.md — Validação do 02 + conteúdo que faltava

> **Papel:** complemento OFICIAL do `02_Veertex_Vnd.md`, produzido pela validação contra o
> **levantamento de requisitos** (Veertex_Handoff_Requisitos.md — 3 semanas de sessões com
> o Eliab, jul–ago/2026), fonte que o 02 declaradamente não teve. Em conflito, **este
> documento prevalece** sobre o §3 do 02; onde o VND JÁ FOI IMPLEMENTADO, os itens daqui
> entram como **change requests**, não como reescrita.
>
> **Ação estrutural (prioridade):** adicionar `Veertex_Handoff_Requisitos.md` a
> `apps/Veertex/Requisitos/` como fonte-mãe. Metade das "pendências do Eliab" do
> VEERTEX_CONTEXTO_GERAL §10 está respondida nele — inclusive a que o contexto chama de
> "único bloqueio do VND".

---

## 1. Veredito

O 02 está **metodologicamente correto** e as decisões §3.2–§3.9 são majoritariamente
boas. Problemas encontrados: **(A)** a pendência §3.1 já estava fechada no levantamento —
e uma sub-decisão dela conflita com o modelo real; **(B)** três decisões conflitam com o
levantamento; **(C)** conteúdo do VND ausente. O §5 lista o que fica ratificado.

---

## 2. (A) DESBLOQUEIO — Comissão: modelos A e B estão definidos desde 06/ago

Fechados em levantamento com o Eliab e **validados contra planilhas reais** da operação
de referência (Tudodicasa). O modelo é atributo do **cadastro do vendedor (user)**:

### Modelo A — escala de META (vendedores de LOJA/balcão)
- Régua: `vendido ÷ meta do período` → **faixas escalonadas abertas acima de 100%**
  (exemplo do Eliab: 100%→1% · 150%→1,5% · 200%→2%). Faixas e % **customizáveis por
  conta** (pares "faixa % da meta → % de comissão").
- Meta cadastrada por **vendedor × período**. Vendedor da venda = usuário logado que
  criou o pedido (já implementado no VND ✓).
- Abaixo da menor faixa cadastrada → comissão zero (salvo faixa configurada abaixo de 100%).

### Modelo B — escala de RECEBIMENTO (representantes de ROTA)
- Régua: `recebido ÷ carteira da viagem (cobrança + recobrança)` → **% de comissão
  DIRETO** (valores reais da operação: ≥90%→8% · 70–89,99%→7% · 50–69,99%→6%).
  Faixas customizáveis (pares "faixa % de recebimento → % de comissão efetiva").
- Incide sobre o **valor RECEBIDO LÍQUIDO da comissão do revendedor** (revendedor tem %
  individual, efetivado como DESCONTO NO ACERTO — detalhe no 04/ROT).
- **Meta de venda NÃO participa do modelo B.** Sem meta cadastrada não há problema — o
  modelo B nem a consulta.
- **Massa de teste obrigatória** (critério de aceite): planilha real, aba 03-07 —
  96,72% recebido → faixa ≥90% → 8% sobre R$ 46.161,40 = **R$ 3.692,91**; aba 04-05 →
  7% sobre R$ 52.663,90 = **R$ 3.686,47**. A implementação reproduz no centavo.

### Demais comissionados (estrutura no cadastro; gatilho no módulo dono)
- **Gerente:** DOIS percentuais simultâneos — X% sobre resultado da loja + Y% sobre
  recebido da rota.
- **Revendedor (contato tipo `reseller`):** % individual; vira desconto no acerto (ROT).
- **Ajudante de viagem:** **valor FIXO SEMANAL** — não é comissão percentual (ROT).
- Comissão apurada gera **contas a pagar** no FIN (decisão fechada; padrão Bling).

### ⚠️ Correção da sub-decisão do §3.1 do 02
"Comissão **gerada no faturamento**, apurada por item" vale **somente para o Modelo A**
(e mesmo no A a apuração é por **período contra a meta**; o item é base analítica).
**Modelo B NÃO gera no faturamento:** gera no **fechamento da viagem (acerto)**, sobre o
recebido — pedido de rota faturado e não recebido **não comissiona**. Estorno: no A,
cancelamento/devolução estornam ✓; no B não existe estorno — a devolução ocorre no acerto,
ANTES de a venda se concluir (é não-geração). A decisão do 02 de deixar comissão por
último na ordem de implementação **fica ainda mais correta**: o motor A pode nascer com o
VND; o motor B só faz sentido junto com o ROT (viagem/carteira/acerto).

---

## 3. (B) Correções de decisões conflitantes

### 3.1 Origem do pedido (§3.3 do 02)
O enum canônico do levantamento (Visão Geral §2) é
**`origin ∈ {erp, pdv, rota, vitrine, marketplace}`** + campo **`delivery_mode ∈
{retirada, envio, rota_entrega}`** (ausente no 02 — incluir; default `retirada`).
Mapeamento do que foi implementado: `balcao→pdv` (ou `erp` até o PDV existir),
`representante→rota`, `telefone/importacao→erp` (se a granularidade importar, campo livre
`origin_detail`). Change request de baixo custo se o VND já persistiu valores — migrar
valores, manter enum aberto ✓.

### 3.2 Tabela de preço (§2.8 do 02) — é do VND, não do ROT
Levantamento (catálogo): VND inclui "**tabelas de preço multi-canal com degrau por
quantidade**". Entidades: `price_list` e `price_list_item` (produto, preço,
**`min_quantity`** para degrau de atacado). Vínculos possíveis: contato, user/vendedor,
canal (CAN futuro), PDV (futuro). **Use case do VND — resolução de preço por
prioridade:** preço negociado no item → tabela do CONTATO → tabela do VENDEDOR → tabela
do CANAL/PDV → preço base do produto. O ROT **consome** (tabela do representante,
restrita pela Regra Comercial — 04); não é dono. Fatia nova do VND.

### 3.3 Ciclo do pedido (§3.2 do 02) — falta o estágio ORÇAMENTO
Levantamento: "orçamentos E pedidos" são o núcleo do VND; a vitrine (futura) gera
**pré-pedido/orçamento** que o representante autoriza; a referência SuasVendas opera
orçamento→pedido como conversão de primeira classe. Requisito: **`orcamento` como
situação de primeira classe**, anterior a `confirmado`, com validade opcional e conversão
explícita (não some no `rascunho` — rascunho é edição inacabada; orçamento é proposta
emitida ao cliente). O padrão "enum pronto, transição bloqueada com mensagem" do 02 para
`faturado` fica ratificado e serve igual aqui.

### 3.4 Frete (§3.7 do 02) — port sim, com o desenho já decidido
O `FreightQuotePort` deve implementar as decisões D1/D2 do levantamento: use case ÚNICO
de cotação (entradas vitrine/ERP/PDV), timeout ~3s com fallback **tabela de frete
própria → frete manual** (bloqueio apenas na vitrine), **snapshot da cotação escolhida
congelado no pedido** (provedor, serviço, código, prazo, valor, timestamp) e frete CIF
como default configurável quando cobrado no pedido. Detalhamento:
`Levantamento_Logistica_Frete.md` (adicionar ao repo junto com o handoff).
**Isto também redefine o EXP** (pendência do CONTEXTO §10): a COTAÇÃO saiu para o port do
VND ✓; o EXP continua existindo com o restante do pipeline — fila de pedidos a expedir,
separação/conferência, etiqueta (PDF/ZPL), despacho e rastreio — espelhando o sistema
Nexo (código real recebido: Meli/Shopee/Bling/NF-e — análise em documento próprio).

---

## 4. (C) Conteúdo do VND ausente no 02 — fatias novas

1. **`order_payment`** (nasce na V1 — Visão Geral §6): N pagamentos por pedido
   (**pagamento misto**: dinheiro+cartão na mesma venda), com forma, valor, parcelas e o
   bloco TEF-ready (provedor, NSU, autorização, bandeira, status, payload,
   `acquirer_cnpj`) — dormente até PDV/TEF, mas o schema nasce pronto (IN 1608/25-GO
   exige o vínculo pagamento↔NFC-e). Inclui campo de **acréscimo/desconto EM REAIS** no
   fechamento (arredondamento de espécie: 189,78→189,80).
2. **Condições de pagamento nomeadas** (cadastro do VND): promissória, à vista, cartão,
   cheque pré-datado (com data), Pix, boleto. (ROT restringe por vendedor via Regra
   Comercial — 04.)
3. **Calculadora de precificação** (fatia tardia do VND): custo + fixos + tributos +
   custo financeiro + margem desejada → preços Varejo/Atacado/Rota por **markup divisor**
   `preço=(custo+fixos)/(1−%impostos−%comissão−%taxas−%margem)`; canal Rota inclui
   comissões (representante+revendedor) e inadimplência esperada; decomposição visível;
   um clique grava nas price_lists.
4. **Aprovação remota** como padrão da casa: desconto acima da alçada exige gerente —
   presencial **ou por e-mail/WhatsApp** (chega com a engine de notificação; a permissão
   granular do 02 §3.5 é a fundação certa ✓).
5. **Empresa do pedido** = empresa cujo estoque atende (multi-CNPJ segregado: 1 venda =
   1 empresa = 1 remessa) — o VND implementado já exige empresa ✓; registrar a regra de
   consistência com o EST quando a baixa chegar.

---

## 5. Ratificado do 02 (sem mudança)

Limite de crédito bloqueando na confirmação ✓ (fechado no levantamento) · carteirização
em RLS/guard por request (ADR-0007) ✓ · kit registrando pai+componentes ✓ · desconto por
item E pedido, %/valor, com teto por permissão ✓ · parcelas nascem no FIN ao faturar ✓ ·
reserva como movimento com expiração preguiçosa + evento visível ✓ · numeração por
empresa com lock ✓ · `field_config` sobre order ✓ · cancelamento pré-NF no VND, pós-NF no
FIS ✓.

## 6. Pendências que este documento NÃO fecha (continuam com o Eliab)
Nenhuma do VND. (As do CONTEXTO §10 restantes — "o que rota significa" e escopo fino do
EXP — são fechadas pelo handoff + `03A` + futuros `04_Rot` e `09_Exp`.)
