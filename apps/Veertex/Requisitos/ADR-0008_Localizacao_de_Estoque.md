# ADR-0008 — Localização de estoque: o saldo ganha dimensão de local

**Data:** 22/08/2026 · **Status:** aceito · **Decisão de:** Eliab (determinada no `03A_Veertex_Est_Complemento.md`)

## Contexto

O `03_Veertex_Est.md` original derivava o saldo de um `(empresa, produto)` — uma única prateleira por
produto por empresa. O `03A` (complemento definitivo) determina que o saldo passe a ter **dimensão de
localização**: `(empresa, produto, localização)`. O motivo não é do EST — é do **ROT**: consignação é
carga que **sai do depósito e passa a viver "na mão do representante"**. Sem saldo por local, não há
onde essa carga exista. Por isso o `03A` marca esta fatia como **pré-requisito do ROT**, a ser feita
antes de qualquer coisa do módulo de rota.

Como o complemento **determina explicitamente** o modelo de dados (nova tabela, nova coluna
obrigatória, backfill, nova policy de RLS), isto conta como **decidido** — não dispara o gatilho de
parada "modelo de dados além do combinado".

## Decisão

1. **Tabela `stock_locations`** — localização por empresa, tenant-scoped, com RLS. `kind ∈
   {warehouse, rep_load, pdv}`: `warehouse` (depósito) hoje; `rep_load` (carga de viagem) nasce
   **pelo ROT**; `pdv` **reservado**. Toda empresa nasce com uma `warehouse` default ("Depósito
   principal") — no onboarding (`create-account`), na criação de empresa (`create-company`) e, para as
   empresas já existentes, no backfill da migration.

2. **`stock_movements.location_id` NOT NULL** — todo movimento aponta um local. Como a tabela **já
   tinha linhas**, a coluna entra em três tempos dentro da mesma migration (padrão da regra 9 do
   CLAUDE.md para coluna obrigatória em tabela populada): nullable → backfill para a `warehouse`
   default da empresa de cada movimento → `NOT NULL` + FK. A nulidade é transitória e documentada.

3. **Saldo derivado, agora por local.** O consolidado da empresa continua sendo a soma de todos os
   movimentos (`listByCompanyProduct`); o recorte por local usa `listByCompanyProductLocation`. O
   `GetStockBalance` aceita `locationId` opcional.

4. **O negativo é aferido POR localização.** Uma saída que zeraria um local é bloqueada ainda que
   outro local cubra o total da empresa — senão "tenho no total" venderia o que não está naquele
   local. A preferência `stock_allow_negative` continua sendo o único jeito de permitir.

5. **Transferência interna = par atômico** (`TransferStockUseCase`). Move quantidade entre dois locais
   da MESMA empresa gravando `transfer_out` na origem e `transfer_in` no destino, na mesma transação —
   nunca um sem o outro. Ambos estampam o **custo médio vigente da empresa**, então o total e a média
   da empresa ficam **inalterados**; só muda a distribuição entre locais. **Não é operação fiscal** (a
   transferência ENTRE EMPRESAS é que é, e depende do FIS — segue fora).

6. **Enum de tipos nasce completo.** `stock_movements_type_check` já admite `transfer_out`,
   `transfer_in` (implementados) e os reservados do ROT (`trip_load`, `trip_return`, `exchange_in`,
   `exchange_out`) — o enum não migra de novo quando o ROT chegar. Criar um tipo reservado (ou de
   transferência) pelo **registro manual** é recusado: `REGISTERABLE_MOVEMENT_TYPES` gira só nos seis
   tipos operacionais; transferência entra pelo use case dedicado, os do ROT chegam com o ROT.

## Por que o custo da transferência não mexe na média

`transfer_out` sai pelo custo médio da época (não muda a média, como toda saída). `transfer_in` entra
pelo **mesmo** custo — como o custo de entrada é igual à média vigente, a média ponderada não se move.
Resultado: transferir é neutro para o custo da empresa, exatamente o que se espera de mover mercadoria
de uma prateleira para outra dentro da mesma empresa.

## Limites conhecidos (registrados, não escondidos)

- **Reserva ainda é por `(empresa, produto)`, sem local.** O disponível do recorte por local é o
  físico do local; o desconto de reservas fica no consolidado da empresa (onde a reserva pesa). Dar
  dimensão de local à reserva é follow-up para quando o ROT/consignação exigir.
- **Kit não transfere.** Kit não tem saldo próprio (§2.5) — o disponível é derivado dos componentes;
  não há o que mover.
- **Sem UI de local ainda.** Não existe tela de registro/transferência de movimento no frontend hoje
  (o EST só lê saldo). O seletor de localização entra junto com essa tela — não há UI para quebrar.
- **Rename/deactivate de localização** existem no domínio mas **sem use case** nesta fatia; por isso o
  repositório grava por INSERT puro (sem upsert), o que também evita o filtro `tenant` disparar no
  onboarding sob o papel operador.

## Como se verifica

- `test/unit/stock-location.spec.ts`: negativo por local (não pela soma da empresa); registro recusa
  local inexistente / de outra empresa; registro recusa tipo não-registrável; transferência mantém
  total e média da empresa e move a quantidade; bloqueia origem negativa; recusa mesmo-local e
  local de outra empresa.
- `verify:isolation` verde no mesmo commit — `stock_locations` (tem `account_id`) tem policy de RLS.
- Migration aplicada com backfill (nenhum movimento fica sem local).
