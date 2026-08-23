# RELATÓRIO — Leva 2: FIN fatias 4–5 + pendências + acréscimos ratificados

Data: 23–24/08/2026 · Branch: `feat/field-config-preferencias` · Commits: `ebce707` (Mesa),
`60bc310` (due rule+clamp), `3e9e9ba` (batimento/tripId/faixas B), `8a3def9` (reservas),
`c48b08a` (client_uuid), `71a4929` (FIN 4–5). **467 testes verdes (51 suítes)**; `next build`
limpo. ⚠️ Espelho ainda NÃO republicado com a Leva 2 — vai junto com a revisão deste relatório.

## 1. Fix do `/api/intent/approve` + VARREDURA do catálogo (priorizado)

**Causa sistêmica encontrada**: o prompt do Gemini listava só nome+label dos comandos — o modelo
INVENTAVA os nomes de campo por convenção. O `code` do CreateRole era só o primeiro sintoma.

**Correção em 4 camadas** (todas em `ebce707`):
1. `INTENT_COMMAND_FIELDS` — spec de campos por comando (nome/tipo/obrigatório/dica) no catálogo,
   a MESMA lista que o dispatch lê;
2. o prompt enumera os campos EXATOS por comando; para CreateRole/SetRolePermissions enumera os
   códigos de permissão (vocabulário fechado que o modelo não tem como adivinhar);
3. `BuildIntentDraft` deriva o `code` do nome (A-Z0-9_), VISÍVEL com origem `padrao`;
4. `FieldReader`: lista aceita texto "a, b" e flag aceita "true"/"false" — o painel edita todo
   campo como TEXTO (§10), e recusar a edição do próprio painel deixava o operador sem saída.

**Teste de contrato** (`intent-catalog-contract.spec.ts`): cada comando aprova com exatamente os
campos da spec — campo lido fora dela é vermelho de CI, não 400 na frente do operador.

**A varredura, comando a comando:**

| Comando | Resultado |
|---|---|
| CreateRole | **CORRIGIDO** (2 defeitos: `code` ausente → derivado; `permissions` em record/texto → prompt com códigos + coerção) |
| ToggleModule | **CORRIGIDO** (flag editado no painel virava texto "false" → recusado; agora coage) |
| CreateContact | **CORRIGIDO** (lista `types` editada como texto → coerção) |
| SetRolePermissions | **CORRIGIDO** (prompt com códigos + coerção de lista) — ver dúvida 1 (roleId) |
| CreateCompany / CreateProduct | **OK** (campos texto/número/endereço; prompt agora com a spec) |
| UpdateCompany / UpdateContact / UpdateProduct / UpdateUser / AssignRole / InviteUser | **OK** com a spec no prompt — ver dúvida 1 (campos `*Id`) |

## 2. `commission_due_rule` + clamp da recorrência (`60bc310`)

- Preferência da conta: `last_day_of_period` (default = comportamento original, sem breaking) |
  `day_n_next_month` + dia (1–28, default 5). Migration aditiva; controle na tela de Preferências.
- `commissionDueDate()`: função PURA única — Modelo A e fechamento de viagem (B) usam a MESMA.
- Recorrência: 31/jan + 1 mês → 28/29-fev (clamp), e março VOLTA a 31. Bissexto testado.

## 3. Acréscimos ratificados por você (`3e9e9ba`, `8a3def9`, `c48b08a`)

- **Batimento re-exibível**: `GET /trips/:id/closure` por **recomputação determinística** (decisão
  registrada — não snapshot): blocos pela MESMA `computeClosureBlocks` do fechamento (extraída
  para `trip-closure-math.ts`) sobre dados append-only; folha pelos `closure_*` persistidos;
  `appliedThresholdPercent` NÃO recomputado de faixas que podem ter mudado (vem `null` — o % e o
  valor PAGOS são os persistidos). Massa real do B intacta ao centavo após a extração.
- **Filtro `tripId` server-side** em GET /orders; a tela da viagem deixou o filtro client-side.
- **Faixas do modelo B editáveis** (GET/PUT `/commission/b-tiers`): requisito do levantamento;
  default real (50→6, 70→7, 90→8) como seed com `usingDefault` visível; invariantes (limiar
  único, comissão não-decrescente); painel na tela de comissão.
- **Reservas**: `GET /stock/reservations` + aba na tela de estoque. **Expiração VISÍVEL na
  leitura**: ativa vencida é MARCADA `released/expired` (persistido/auditável) — sem agendador
  (BullMQ segue fora); alerta na tela destaca as expiradas.
- **`client_uuid` idempotente** (fundação do sync do app, antecipada): pedido, recebimento,
  evidência e despesa aceitam uuid do aparelho; reenvio devolve o existente. Índice único parcial
  `(account_id, client_uuid)` como rede; sem uuid, nada muda.

## 4. FIN fatias 4–5 (`71a4929`)

- **Fatia 4 — `customer_credit` DORMENTE** (05 §2.5): entidade/tabela/port/adapter prontos;
  nenhum fluxo grava até o FIS (a devolução é coordenada, 02 §3.8). Invariantes testadas:
  valor positivo, consumo parcial no MESMO crédito, consumido/cancelado não reconsome.
  RLS + grant select/insert/update (nunca DELETE). Sem tela (nada a mostrar — dormente).
- **Fatia 5 — dashboard**: `GET /finance/dashboard` — recebido/pago 7 dias, comparativo com os
  7 anteriores, vencidos, a vencer em 7 — POR EMPRESA e total (§2.6). Agregação no use case
  (testada sem banco); cards na tela do financeiro com seletor de empresa e delta.

## 5. Decisões solo registradas

1. Coerção lista/flag no `FieldReader` (o painel edita como texto — recusar seria beco).
2. `appliedThresholdPercent = null` na re-exibição (faixa atual pode ter mudado; o pago é o
   persistido — recomputar mentiria).
3. Expiração de reserva marcada NA LEITURA (lazy, sem agendador) — persistida, não silenciosa.
4. Idempotência: check-then-insert + índice único como rede; a outbox reenvia sequencialmente e
   o retry seguinte encontra o existente (corrida real vira erro no segundo push e acerto no
   retry — nunca duplicata).
5. `payableTitleIds` não persiste → volta vazio na re-exibição (os títulos vivem no FIN).

## 6. Dúvidas acumuladas

1. **Campos `*Id` na Mesa** (roleId/userId/companyId/contactId/productId): o dispatch os exige e
   ninguém dita UUID. Hoje: ficam "a decidir" e o operador não tem como preencher de cabeça.
   Proposta: resolução nome→id no rascunho (lookup com origem `consulta`; ambiguidade vira
   pergunta em `unresolved`). É a peça que falta para "trocar o papel da Ana" funcionar de ponta
   a ponta. Fatia própria — autoriza?
2. **Aceite 5 da fatia 5** ("isolamento com fixtures nas duas contas"): o dashboard está sob RLS
   como toda leitura; o teste de fixtures em duas contas é integração com banco — incluo na
   próxima passada de testes de integração (o `verify:isolation` já cobre as tabelas novas)?
3. Espelho: republico com a Leva 2 agora ou junto com a Leva 3 (COB)?

## Próximo passo (sem esperar): LEVA 3 — COB (06) completo

BillingProviderPort + boleto/Pix até a fronteira (config com botão Testar, adapter
pronto-para-credencial), webhook→baixa idempotente, régua (propõe por default; automático opt-in
registrado), bloqueio por inadimplência (preferência+override no VND), carnê/crediário, automação
da "perdida" na régua. Aguardando suas credenciais do agregador (Kobana/TecnoSpeed/Asaas) — sem
travar: a fronteira nasce pronta.
