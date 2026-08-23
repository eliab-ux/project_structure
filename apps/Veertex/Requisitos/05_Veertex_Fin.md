# 05_Veertex_Fin.md — Módulo FIN (Financeiro)

> **Versão reescrita a partir da FONTE-MÃE** (handoff, catálogo FIN + árvore financeira
> real absorvida do Bling/OTEC) — substitui o esqueleto. As decisões §3.1–§3.10 do
> esqueleto estão respondidas. Correção herdada do 02A: comissão modelo B é gerada no
> ACERTO da viagem (ROT), não no faturamento — o §2.3 do esqueleto vale só para o modelo A.

## 1. Objetivo e corte da V1 (resposta ao §3.1)

Contas a **receber** e a **pagar**, baixas (inclusive parciais), **contas financeiras**
(caixa/banco), **categorias hierárquicas** com mapeamento explícito para DRE, e a visão
de caixa/dashboard. **Fora da V1** (fase 2, já nomeadas): conciliação bancária/OFX/Open
Finance, centro de custo, DRE renderizado (a ESTRUTURA de mapeamento nasce agora; o
relatório vem depois), fluxo de caixa projetado avançado.

## 2. Regras de negócio

### 2.1 Títulos a receber
- Nascem: (a) no **faturamento** do pedido VND, conforme a condição de pagamento (parcelas
  materializadas aqui — decisão do 02 ratificada); (b) no **ciclo de consignação** do ROT
  (título do pedido consignado, vencimento ≈ próxima passagem — ver 04 §3.4);
  (c) lançamento manual.
- **Baixa parcial: saldo residual no MESMO título** (decisão — o recebimento em campo da
  rota é parcial por natureza; dois títulos por baixa explodiria a carteira). Situações:
  `open → partial → settled`, + `renegotiated` e `written_off_pending/written_off`
  (política "perdida" do 04 §3.4 — o FIN é onde o título espera a baixa manual).
- **Juros e multa: existem na V1** (a rota cobra juros de atraso — fato da operação).
  Calculados no FIN na baixa (parâmetros por conta; COB apenas apresenta — decisão do
  esqueleto do 06 ratificada). Desconto por antecipação: fase 2.

### 2.2 Títulos a pagar (resposta ao §3.2 — origem)
V1: (a) **lançamento manual** (com recorrência simples: repetir N meses — aluguel,
energia); (b) **comissões** — folha da viagem (ROT) e apuração de loja (VND) geram
contas a pagar (decisão fechada; padrão Bling "gerenciar comissões via contas a pagar");
(c) **tarifas/taxas** informadas por integrações (COB/frete) quando chegarem. CMP
(compras) alimentará quando existir.

### 2.3 Contas financeiras (resposta ao §3.6)
Cadastro na V1: nome, tipo (`cash | bank | payment_integration`), instituição, saldo
inicial, ativa. Toda baixa aponta para uma conta. Tipos `manual × automática` (a
automática é alimentada por integração — preparação para COB/Open Finance). Transferência
entre contas financeiras = par de lançamentos com categoria **neutra** "transferência"
(não é receita nem despesa — lição da árvore real; jamais infla resultado).

### 2.4 Categorias financeiras (resposta ao §3.8)
**Árvore hierárquica** de receitas × despesas por conta, com: **mapeamento explícito
categoria → linha de DRE** (campo desde já; relatório fase 2), **categoria padrão por
operação** (venda→faturamento; compra→custo; comissão→despesa comercial; tarifas
bancárias por evento) e seed inicial inspirado na árvore real absorvida (Receita Bruta;
Custo Direto/Indireto; Despesas; Fretes; Tarifas Bancárias; Impostos; Transferência
neutra). Importar/exportar categorias: fase 2.

### 2.5 Devolução e transferência entre empresas (respostas §3.9/§3.10)
- **Devolução** (operação coordenada VND+EST+FIN, pós-FIS): no FIN, **estorna o saldo do
  título por lançamento novo** (append-only) e, se já recebido, **gera crédito do
  cliente** (entidade `customer_credit`, consumível em título futuro). Os dois, conforme
  o caso — nunca alteração do lançamento original.
- **Transferência entre empresas**: **NÃO gera título financeiro na V1** — é operação
  fiscal/estoque (FIS). Se a conta quiser registrar acerto financeiro entre CNPJs, faz
  lançamento manual. (Decisão de corte, reversível.)

### 2.6 Regras de projeto (ratificadas do esqueleto)
Lançamento **append-only** (estorno = lançamento novo) · precisão 4 casas no cálculo /
2 na exibição · título pertence a UMA empresa; **empresa é filtro E comparativo em todo
relatório/card** · `account_id` + RLS + `verify:isolation` no mesmo commit.

## 3. Entidades (conceitual)

`financial_account` · `financial_category` (árvore, dre_line, defaults por operação) ·
`receivable`/`payable` (ou `financial_title` com direção) · `title_settlement`
(baixa: conta financeira, forma, valor, juros/multa/desconto, origem) ·
`customer_credit` · `recurrence` (simples, a pagar).

## 4. Ordem de fatias

1. Contas financeiras + categorias (com seed e mapeamento DRE).
2. Título a receber + baixa (parcial, juros/multa) — nasce do faturamento e do manual.
3. Título a pagar + recorrência simples + destino das comissões.
4. Crédito de cliente + estorno por devolução (dormente até FIS; schema pronto).
5. Cards do dashboard (7 dias, por empresa, comparativo).

## 5. Critérios de aceite

1. Faturar pedido gera parcelas conforme condição, na empresa do pedido.
2. Baixa parcial deixa saldo residual correto no título; nada é alterado, só acrescido.
3. Transferência entre contas financeiras não aparece como receita/despesa em nenhum
   relatório.
4. Comissão fechada (viagem/loja) aparece como conta a pagar com categoria padrão.
5. Card de 7 dias filtra e compara por empresa; isolamento com fixtures nas duas contas.
6. Zero violações do `CLAUDE.md`.
