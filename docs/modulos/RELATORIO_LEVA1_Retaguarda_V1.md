# RELATÓRIO — Leva 1: frontend da retaguarda + retoques do adendo

Data: 23/08/2026 · Branch: `feat/field-config-preferencias` · Commits: `85db4b3` (retoques),
`49b5675` (proposta Capacitor), `dc2abe4` (telas). 432 testes de unidade verdes; `next build`
limpo com lint `--max-warnings=0`.

## 1. Os 3 retoques de backend do adendo — ENTREGUES

| Retoque | Como ficou |
|---|---|
| **Condição de pagamento no pedido** (02 §3.6) | `orders.payment_condition_id` + `contacts.default_payment_condition_id` (migration aditiva, nullable — venda sem condição é válida). Herança do default do contato acontece UMA vez, na criação, no servidor; editável em rascunho. 4 testes |
| **Comparativo com a viagem anterior** (04 §3.5) | `CloseTrip` devolve `previousTrip`: última fechada da mesma rota, números RECOMPUTADOS das cobranças/recebimentos append-only dela (nunca segunda verdade persistida) + deltas de recebido/%/despesas. 2 testes |
| **GPS → cadastro da revendedora** (04 §3.1) | `ContactGeoPort` + adapter: captura da abertura preenche coordenada VAZIA do endereço (main primeiro); alteração explícita auditada corrige o cadastro junto. Edição de contato deixou de zerar lat/lng em silêncio (preservação por purpose). 3 testes |

## 2. Telas — as ~12 do bloco, todas construídas

**Menu reorganizado em GRUPOS POR MÓDULO** (decisão solo — a barra plana não comportava 17
itens): Mesa · Cadastros▾ · Vendas▾ (VND) · Estoque (EST) · Financeiro (FIN) · Rotas▾ (ROT) ·
Conta▾. Grupo de módulo some inteiro com o módulo desligado; item some por permissão; grupo com
um item vira botão direto.

- **VND-config**: `/sales/price-lists` (itens produto×preço×qtd mínima; alvo geral/cliente/vendedor),
  `/sales/payment-conditions`, `/sales/commission` (faixas A, metas por período, apuração → conta a pagar).
- **Pedido** (`/orders`): Gerar orçamento + Converter em pedido; preço resolvido por
  `/price-lists/resolve` ao escolher produto e ao mudar quantidade (fonte da tabela exibida);
  select de condição com "herdar do cliente (nome do default)"; viagem obrigatória quando
  origem=rota; chips dos status consignados.
- **Contato**: campo "Condição de pagamento padrão" no form.
- **EST** (`/stock`): abas Saldos (físico/disponível/custo médio/valor + por localização +
  alertas mín/máx) · Movimentos (extrato com custo-fallback marcado + registro manual dos 6 tipos
  registráveis) · Localizações (só `warehouse` criável, ADR-0008). Transferência interna como
  par atômico. **Kit**: botão no produto `bundle` com composição lida do GET (backend passou a
  devolver `components` — edição sobre o que existe, nunca às cegas).
- **FIN** (`/finance`): abas Títulos (receber/pagar, filtros, totais aberto/vencido, baixa
  parcial no MESMO título com juros/multa/desconto, recorrente mensal 1–60) · Contas ·
  Categorias em árvore (indentação por pai).
- **ROT**: `/routes` (CRUD com cycle_days + Regra Comercial por representante: checkboxes de
  empresas/condições/tabelas + naturezas) · `/trips` (lista/criação) · `/trips/[id]` — a página
  do dia: carga/romaneio, saída, montar carteira, acerto em DOIS estágios (lançar `proposto` →
  efetivar com conta financeira; fechamento bloqueado com proposto pendente), devolução (custo da
  época), troca em par, despesas, chegada (caixa contado/km), fechamento com o BATIMENTO completo
  (cobrança/recobrança, juros, à vista, despesas por categoria, caixa esperado×contado, folha B,
  comparativo com a anterior) e, por pedido consignado: efetivar → iniciar acerto → fechar com
  vendido real (soldLines) + promissória com valor por extenso.

## 3. Backend de apoio que as telas exigiram (pequeno, testado)

- `GET /trips/:id` — viagem+carteira+recebimentos+despesas. Sem ele, recebimento `proposto`
  sumia da tela num reload: dado órfão invisível.
- `GET /products/:id` devolve `components` para `bundle`.

## 4. Proposta do app Capacitor — ANEXA (item obrigatório)

`apps/Veertex/Requisitos/PROPOSTA_App_Capacitor.md` — estrutura `apps/Veertex/mobile/`,
contrato compartilhado, sync offline por fila de mutações com `client_uuid` idempotente
(conflito não existe por desenho: campo só propõe, retaguarda efetiva), plugins
térmica/GPS-fundo/câmera. **4 perguntas aguardam a aprovação** (local do código compartilhado;
client_uuid antecipado no backend; intervalo/retenção do rastreio; hardware da térmica).

## 5. Decisões solo registradas

1. GPS: alteração auditada TAMBÉM propaga ao cadastro (`overwrite=true`) — deixar o ponto errado
   no cadastro perpetuaria o erro que a ação corrige. Primeira captura nunca sobrescreve.
2. Edição de contato preserva lat/lng por purpose (antes zerava em silêncio).
3. Menu em grupos por módulo (acima).
4. As duas leituras novas do §3 (fechar buraco de dado invisível > pureza do "só as fatias pedidas").
5. Pedidos da viagem: a API não filtra por `tripId`; a tela filtra client-side (volume baixo).

## 6. Dúvidas acumuladas (nenhuma travou — registro para decisão)

1. **Reservas sem leitura HTTP**: a tela mostra só o disponível líquido. Proponho
   `GET /stock/reservations` + o EVENTO VISÍVEL de expiração (02 §3.9, requisito seu de 22/08)
   aparecendo na Mesa/aviso — entra na Leva 2?
2. **Batimento de viagem fechada**: os inputs persistem (`closure_*`), mas o GET não os devolve —
   reabrir uma viagem fechada não re-exibe o batimento (só na hora do fechamento). Exponho na Leva 2?
3. **Filtro `tripId` em GET /orders** — barato; adiciono na Leva 2 junto com o resto?
4. **Comissão modelo B — faixas por conta**: o motor lê `commission_b_tiers` com default das
   faixas reais, mas não há endpoint/tela para editá-las (o modelo A tem). Adiciono?
5. As **4 perguntas da proposta Capacitor** (§4 acima).

## 7. Produção

O espelho `eliab1/veertex` foi republicado com a Leva 1 — **Redeploy** no Dokploy (backend e
frontend) traz tudo; migrations aditivas aplicam sozinhas no boot. Lembretes em aberto:
`MINIO_*` no Environment quando o MinIO subir; rotação das credenciais que passaram pelo chat.

## Próximo passo (sem esperar): LEVA 2

FIN fatias 4–5 (crédito de cliente/estorno dormente até FIS; cards do dashboard 7 dias/por
empresa/comparativo) + `commission_due_rule` + clamp da recorrência — com telas.
