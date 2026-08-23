# 03A_Veertex_Est_Complemento.md — Validação do 03 + a correção que não pode esperar

> **Papel:** complemento OFICIAL do `03_Veertex_Est.md`, validado contra o
> **levantamento de requisitos** (Veertex_Handoff_Requisitos.md). Em conflito, este
> documento prevalece. O EST já tem fundação implementada (movimento append-only, saldo e
> custo derivados) — os itens daqui são **change requests dimensionados para essa
> fundação**, e um deles é URGENTE por ordem de dependência.

---

## 1. Veredito

A fundação implementada está **certa e ratificada**: movimento append-only garantido
pelo banco (runtime sem DELETE) ✓ · saldo/custo derivados por SUM ✓ · custo médio
ponderado móvel com devolução pelo custo da época + fallback declarado ✓ · bonificação
entrando no cálculo ✓ · saldo por empresa segregado ✓ · transferência entre empresas só
com FIS ✓ · kit sem saldo próprio ✓ · estoque negativo bloqueado por preferência ✓ ·
reserva com expiração preguiçosa e evento visível ✓.

**Um conflito grave** (§2) e complementos menores (§3).

---

## 2. ⚠️ CONFLITO CRÍTICO — §3.5 do 03 ("sem múltiplos depósitos no V1") inviabiliza o ROT

### O que o levantamento estabelece
O módulo de ROTA — o diferencial do produto — opera **consignação com carga por
representante**: a mercadoria SAI do depósito da empresa e passa a existir "na mão do
representante" durante a viagem (~60 dias), onde sofre venda, devolução, troca e retorno,
com **conferência de estoque no acerto** (carga − vendas − trocas = deve sobrar X). Ou
seja: **o estoque tem DIMENSÃO DE LOCALIZAÇÃO por natureza** — no mínimo `depósito da
empresa` e `carga do representante/viagem`. Sem isso, o ROT não tem onde existir:
`ROT → EST` é dependência declarada, e a parte do EST que o ROT consome é exatamente a
que o §3.5 adiou.

O 03 §3.5 ainda observa, correto, que adiar "muda a PK do saldo e o modelo de movimento"
— ou seja, o próprio documento reconhece que corrigir depois é caro. Com o ROT como
próximo grande módulo, "depois" é já.

### A correção — dimensionada para a fundação derivada (custo baixo AGORA)
A sorte da arquitetura escolhida: **saldo derivado torna a correção barata** — não há
tabela materializada para migrar; é adicionar dimensão ao movimento e recalcular nada.

1. Entidade **`stock_location`** por empresa: `id, account_id, company_id, kind
   (warehouse | rep_load | pdv-futuro), name, active`, com **uma localização default
   `warehouse` criada por empresa** (migration cria para as existentes; criação de
   empresa passa a criar a sua).
2. **`stock_movement.location_id NOT NULL`** — backfill dos movimentos existentes para a
   default da empresa (determinístico, sem ambiguidade: hoje só existe um lugar).
3. Saldo/disponível derivados passam a aceitar recorte por localização:
   `saldo(empresa, produto[, localização])`. Consultas atuais (sem recorte) continuam
   válidas — somam todas as localizações da empresa.
4. **Movimentos internos entre localizações da MESMA empresa = par de movimentos
   (saída+entrada) SEM documento fiscal** — o levantamento fecha isso explicitamente
   ("entre depósitos do mesmo CNPJ é livre"); entre EMPRESAS continua só com FIS ✓.
5. `kind = rep_load`: localizações de carga são criadas/geridas pelo ROT (uma por
   viagem ou por representante — decisão do 04), mas o TIPO nasce agora para o enum não
   mudar depois.

**Gatilho de execução:** antes da primeira fatia do ROT — idealmente como a PRÓXIMA fatia
do EST, enquanto o histórico de movimentos é pequeno e o backfill é trivial.

---

## 3. Complementos menores

### 3.1 Tipos de movimento (§3.6 do 03) — reservar os da rota no enum
O enum inicial do 03 está bom; declarar desde já (enum aberto, sem implementar):
`transfer_out/transfer_in` (interno entre localizações — §2 acima), `trip_load`
(carga p/ representante), `trip_return` (retorno), `exchange_in/exchange_out`
(troca no acerto — par vinculado), `loss` já existe ✓. Produção
(`production_in/consumption`) chega com o PRD.

### 3.2 Inventário (§3.7) — ratificado com nota
Ajuste unitário no V1 ✓. Registrar que o levantamento prevê contagem/balanço com ajuste
auditado como fase 2 (referência Bling/lotes) — fatia futura já nomeada.

### 3.3 Lote/validade (§3.8) — ratificado
Fora do V1 ✓; o levantamento confirma (controle de lotes = fase 2, relevante para
alimentos/cosméticos). A decisão do 03 coincide com o levantamento.

### 3.4 Unidade base (§3.9) — ratificado
✓, com a nota de que DUN-14/caixa entra com CMP, como o 03 já diz.

### 3.5 Saldo derivado (§3.1) — ratificado com o gatilho anotado
O levantamento rascunhava materializado+trilha; a implementação derivada é SUPERIOR à
rascunhada (uma verdade só) e fica ratificada. Mantido o gatilho do 03: se a leitura
degradar com histórico grande (a rota gera muitos movimentos), materializa com
verificação periódica contra os movimentos — verificação que precisa "já ter sido vista
falhando" (regra da casa ✓).

---

## 4. Ordem sugerida (revisão da §4 do 03)

1. **Localizações de estoque (§2 deste doc)** — próxima fatia do EST, pré-ROT.
2. Disponível do kit derivado dos componentes (como no 03).
3. Alertas de mínimo/máximo (como no 03).
4. Integração reserva/baixa com VND (como no 03; reserva pode ganhar recorte por
   localização junto da fatia 1 ou na integração — decidir na fatia).
5. Transferência entre empresas — só com FIS (inalterado).

## 5. Critérios de aceite adicionais

1. Mesma empresa, duas localizações, mesmo produto: saldos por localização independentes
   e soma correta no agregado — por teste.
2. Movimento sem localização não é gravável (NOT NULL + validação de domínio).
3. Transferência interna gera PAR atômico de movimentos (saída+entrada na mesma
   transação) e não altera o saldo agregado da empresa — por teste.
4. `verify:isolation` cobre `stock_location` no mesmo commit da migration (regra da casa).
