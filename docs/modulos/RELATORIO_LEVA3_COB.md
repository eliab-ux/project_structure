# Relatório — Leva 3: COB (06) completo + suíte smoke de todas as rotas

**Data:** 24/08/2026 · **Branch:** `feat/field-config-preferencias` · **Execução contínua** (protocolo do Eliab)

**Commits da leva:** `b676fa0` (domínio+aplicação) · `bfc3f93` (infra+bloqueio+hotfixes) ·
`2400975` (testes do motor) · `9f710ff` (telas) · + o commit da suíte smoke e deste relatório.

---

## 1. O que foi entregue

### 1.1 Fronteira do agregador — pronta-para-credencial (BillingProviderPort)

- **Port** `BillingProviderPort` (`registerCharge`/`cancelCharge`/`testConnection`/`parseWebhook`
  normalizado) — o COB inteiro fala com essa interface; o agregador real (Kobana/TecnoSpeed/Asaas)
  entra como adapter quando a credencial existir, **sem mudar nada do resto**.
- **Default fail-closed**: `NotConfiguredBillingProvider` — emitir sem credencial RECUSA com
  mensagem clara ("não trave" = o módulo abre, configura e testa; o que não existe é boleto de
  mentira). `testConnection` devolve `{ok:false, message}` — é o botão **Testar** da tela.
- **Credencial cifrada em repouso**: aes-256-gcm com `BILLING_CREDENTIALS_KEY` (64 hex, no
  `.env.example`). Sem a chave, salvar credencial recusa LOUD com o comando de geração — credencial
  em claro "só por enquanto" é como credencial vaza.
- Config por conta com **empresa específica vencendo a geral**; conta de liquidação da baixa
  definida na config.

### 1.2 Webhook → baixa automática idempotente

- Rota **pública** `POST /api/billing/webhook/:accountId/:configId?token=...` — é o PROVEDOR quem
  chama. Autenticação própria: token por config (sha256 + `timingSafeEqual`), **mostrado UMA vez**
  na resposta do salvar; guardado só o hash.
- `establishFromAuthenticatedUser(accountId)` **antes de qualquer leitura** — 4º call site nomeado
  do tenant scope (login, reset, CLI, webhook).
- **Idempotência no banco**: `billing_webhook_events` com `@Unique(accountId, externalEventId)`;
  `registerOnce` captura `UniqueConstraintViolationException` → a MESMA notificação duas vezes é
  UMA baixa (aceite 3).
- Pago → `SettleTitle` na conta de liquidação, método = instrumento (pix/boleto), principal =
  `paidAmount ?? saldo em aberto`; **tarifa vira conta a pagar** na categoria `bank_fee`.
- Payload desconhecido/token inválido → `{outcome:'ignored'}`, **nunca 500** (o provedor faz retry
  em loop sobre 500) e **sem oráculo** (resposta uniforme).

### 1.3 Régua de cobrança (dunning) — propõe por default

- `DunningRule` com etapas (offset −60..+365 dias, canal whatsapp/e-mail, template com
  `[NOME] [VALOR] [VENCIMENTO]`, modo) e `maxRebillings` (0–12, default 3).
- **Modo default = propor**: a rodada gera `DunningEvent` `proposed` com a mensagem já resolvida
  (snapshot) — **nada sai sem aprovação humana** (aceite 4). **Automático é opt-in POR ETAPA**,
  registrado (`autoEnabledBy`/`At`).
- Envio WhatsApp pela **instância de SISTEMA** do Evolution; e-mail **recusa até haver SMTP**
  (decisão solo — ver §3). O texto da mensagem **jamais entra em log**.
- Sem agendador (BullMQ fora do escopo): o gatilho é o botão **Rodar régua** — o mesmo caminho que
  um cron chamará depois.

### 1.4 Política "perdida" (04 §3.4) — automatizada

- A etapa de **maior offset positivo é a recobrança** e repete espaçada pelo próprio offset;
  completadas `1 + maxRebillings` passagens sem pagamento, o título vira `written_off_pending` e
  **sai da régua** (aceite 5). Decisão solo registrada no código (24/08).

### 1.5 Bloqueio por inadimplência na confirmação do pedido

- Preferências `overdueBlockEnabled`/`overdueBlockDays` (default ligado/30 dias, clamp 0–365) na
  tela de Preferências; checagem no `ChangeOrderStatus` ao confirmar: cliente com título vencido
  além do prazo → `OverdueCustomerException` nomeando valor, dias e a permissão de override
  (`orders.overdue.override`).

### 1.6 Renegociação mínima + carnê

- `POST /billing/renegotiations`: títulos antigos **sinalizados** `renegotiated` (histórico
  preservado, nunca alteração), novos nascem origem `renegotiation` com os dois totais na
  descrição.
- **Carnê = visão de impressão no frontend** (decisão solo): a aba Inadimplência lista os títulos
  abertos do cliente e imprime a própria tabela (`window.print`) — sem backend novo.

### 1.7 Telas (`/billing`, menu "Cobrança", módulo COB)

- **Configuração**: agregador + credencial (nunca reexibida) + conta de liquidação + Testar;
  URL do webhook exibida UMA vez ao salvar (montada sobre a origem do navegador).
- **Cobranças**: emitir boleto/Pix de título em aberto; lista com situação.
- **Régua**: etapas editáveis, modo por etapa, maxRebillings, Rodar régua, fila de propostas com
  **Aprovar e enviar**.
- **Inadimplência**: títulos por cliente, alerta de vencidos, carnê imprimível, renegociação com
  resíduo de arredondamento na última parcela.

## 2. Suíte smoke de TODAS as rotas (pedido explícito de 24/08)

`test/execution/smoke-all-routes.spec.ts` — a lista de rotas sai do metadata do próprio
`HttpModule` (**rota nova entra na varredura sozinha**, sem lista paralela). Quatro varreduras,
cada uma contra uma categoria de erro que já aconteceu em produção:

| Varredura | O que prova | Categoria que mata |
|---|---|---|
| **Censo GET** (toda rota GET, token válido) | responde 200/204/400/404 — nunca 500, nunca 401/403 | `GET /products` 500 da linha envenenada |
| **Telas principais** (20 listagens curadas) | exatamente 200 com corpo | tela que abre em branco |
| **Censo de validação** (toda mutação, corpo `{}`) | nunca 500 | handler alcançado com `undefined` |
| **Censo de autenticação** (toda rota não pública, sem token) | exatamente 401 | guard declarado mas não executando |
| **Isolamento** (fixtures em DUAS contas — FIN-5 aceite 5) | contato/produto/título da conta A invisíveis para a B; GET cruzado = 404 e o dono continua vendo 200 | vazamento entre contas |

**Resultado: 7/7 verde.** A suíte já pescou uma regra real na primeira execução: produto sem
`kind` é recusado pelo field-config ("Tipo" obrigatório por padrão) — a fixture foi corrigida,
e a mensagem de fixture agora sempre inclui o corpo da resposta.

Testes unitários do COB (commit `2400975`): 11 casos (motor da régua 6, webhook 5) — pescaram
1 defeito real (`DunningRule.create` com etapa automática era impossível; ganhou `actorUserId`).

## 3. Decisões solo registradas (para ratificar ou reverter)

1. **Perdida por repetição de offset**: a recobrança repete a cada próprio offset até
   `1 + maxRebillings` passagens — leitura mais simples e auditável do "1 cobrança + N recobranças"
   fora da rota.
2. **Token do webhook na URL** (`?token=`), hasheado no banco e comparado em tempo constante;
   mostrado UMA vez. Alternativa (header custom) não funciona em todos os agregadores.
3. **E-mail da régua recusa até haver SMTP configurado** — mesmo padrão fail-closed do provedor;
   o canal WhatsApp funciona desde já pela instância de sistema.
4. **Carnê = impressão no frontend** sobre os títulos abertos do contato — sem endpoint novo,
   sem PDF no backend. Se o carnê precisar de layout bancário formal, vira fatia própria.
5. **PDF do boleto no MinIO** (`billing/{account}/{chargeId}.pdf`) com adapter Noop quando
   `MINIO_ENDPOINT` ausente.

## 4. Dúvidas em aberto (não travam nada)

1. **Qual agregador contratar** (Kobana/TecnoSpeed/Asaas)? A fronteira aceita os três nomes; o
   adapter real será escrito quando a credencial existir.
2. **SMTP**: haverá e-mail de régua ou WhatsApp basta? (Se basta, removo o canal da UI.)
3. Da Leva 2, ainda sem resposta: resolução nome→id na Mesa (proposta enviada).

## 5. Pendências que ficaram FORA desta leva

- Adapter real do agregador (aguarda credencial) e agendador (cron/BullMQ) da régua.
- Levas 4 (EXP + FreightQuotePort) e 5 (CAN + variações) — aprovadas, não iniciadas.
- FIS (07) — só por ordem explícita.
- App Capacitor — após as levas.

## 6. Ações do Eliab

- **Redeploy do backend** (hotfixes de produção + COB) e do frontend (telas novas).
- Push no GitHub em terminal normal (branch ~25 commits ahead).
- Quando for usar o COB de verdade: `BILLING_CREDENTIALS_KEY` (64 hex) e `MINIO_*` no env do
  Dokploy; credencial do agregador escolhido.
- Rotação das credenciais que passaram pelo chat (lista já registrada).
