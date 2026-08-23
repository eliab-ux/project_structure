# 04_Veertex_Rot.md — Módulo ROT (Venda por Rota / Consignação)

> **Versão reescrita a partir da FONTE-MÃE** (`Veertex_Handoff_Requisitos.md`, seção 5 e
> decisões de 03–07/ago/2026) — substitui o esqueleto anterior. As perguntas §3.1–§3.6 do
> esqueleto estão TODAS respondidas aqui. Complementa: `02A` (comissão modelo B, tabela de
> preço no VND) e `03A` (localizações de estoque — pré-requisito deste módulo).
> É o módulo-diferencial do produto. Dependência: `ROT → EST` (com localizações).

## 1. O que "rota" significa neste negócio (resposta ao §3.1 do esqueleto)

**Venda consignada itinerante (pronta-entrega/mascate).** O REPRESENTANTE sai numa
VIAGEM por uma ROTA (região geográfica: "Rondonópolis", "Campo Grande 1001"...) levando
mercadoria consignada, que deixa com REVENDEDORAS (contatos tipo `reseller` que revendem
na ponta). ~60 dias depois, na viagem seguinte pela mesma rota, faz o ACERTO: recebe o
que foi vendido, aceita devoluções e trocas, e deixa nova carga. Não é roteirização de
entrega (isso é o módulo ENT, onda futura — o papel Entregador pertence a lá).

## 2. Glossário e papéis

- **Rota** (`route`): cadastro de região/circuito. Cliente é **carteirizado** por rota +
  representante (campos do contato `reseller`: rota, representante da carteira — que é a
  MESMA carteirização do ADR-0007 aplicada com dono = representante; não é conceito novo).
- **Viagem** (`trip`): execução de uma rota por **1 representante** (sempre 1×1 — decisão
  fechada) + **ajudante opcional** (remuneração **FIXA SEMANAL**, não comissiona %, não
  vende — sem login de venda). Campos: rota, representante, ajudante?, datas saída/
  chegada, **caixa inicial/caixa de retorno** (dinheiro), **km inicial/final**, status.
- **Revendedor**: contato `reseller` com **% de comissão INDIVIDUAL** (típico ~30%).
- **Gerente**: comissiona Y% sobre o recebido das viagens (X% loja é do VND — ver 02A).

## 3. O ciclo da consignação (regras de negócio)

### 3.1 Ida (viagem N) — consignar
1. Carga: transferência de estoque `warehouse → rep_load` (localizações do 03A;
   movimento `trip_load`), registrada como romaneio da viagem.
2. Em campo, o representante lança **pedido nominal por revendedora, item a item**, no
   app. O pedido nasce com `origin='rota'` e **ciclo próprio: `consignado_aberto →
   em_acerto → fechado`** (+cancelado) — NÃO é o ciclo padrão do VND; a venda só se
   conclui no acerto.
3. **Promissória** (`promissory_note`): gerada NA PONTA sobre o total do pedido, impressa
   na térmica portátil (valor por extenso, devedora com CPF/endereço, vencimento ≈
   próxima passagem), assinada como GARANTIA da consignação. 1 por pedido.
4. **Evidências do pedido:** GPS capturado **na ABERTURA** (imutável — edições nunca
   tocam; alteração só por ação explícita do usuário, auditada com valor anterior/novo/
   quem/quando) e propagado ao cadastro da revendedora; **foto-comprovante** (revendedora
   com pedido/documento) e **foto da promissória assinada** — MinIO, comprimidas no
   aparelho, sobem na sincronização.

### 3.2 Volta (viagem N+1) — acertar
Por revendedora, item a item: **pagou** (dinheiro/Pix/cartão/cheque/**depósito
bancário**) → vira venda; **devolveu** → movimento `trip_return` ao estoque; **trocou** →
par vinculado `exchange_in`+`exchange_out` com diferença acertada; **não pagou** → rola
como **RECOBRANÇA** para a próxima viagem. **Juros de atraso** podem ser cobrados
(recebimento classificado). **Venda à vista em campo existe** mas é exceção — classifica
como "outros recebimentos", **fora da carteira** (não entra no % de recebimento).

### 3.3 Dois estágios (regra da casa, preservada da operação real)
O campo LANÇA (pedidos e acertos chegam como propostas); o **ESCRITÓRIO confere e
EFETIVA**. Nada do campo grava definitivo sozinho — coerente com "nada persiste sem
aprovação humana", aqui com aprovador = retaguarda.

### 3.4 Carteira, cobrança e "perdida"
- **Carteira da viagem** = títulos (FIN) dos pedidos consignados da rota com acerto
  previsto naquela passagem (**cobrança**) + títulos rolados de passagens anteriores
  (**recobrança**). Recebimento em campo referencia título + viagem (base da comissão).
- **Política "perdida" (fechada):** após **1 cobrança + 3 recobranças sem recebimento
  (limiar CONFIGURÁVEL por conta)**, o título vira `written_off_pending`
  automaticamente: **sai da carteira** (não viaja mais, não polui o % do representante)
  mas **permanece no FIN** até ação manual — cancelar OU baixar como despesa
  (write-off manual, com permissão). Pagamento posterior: baixa normal.

### 3.5 Fechamento da viagem (batimento — espelha as planilhas reais)
Blocos: **Cobrança** e **Recobrança** (consignado, recebido por forma, %, juros,
dif. troca) · **Outros recebimentos** (venda à vista) · **Despesas da viagem por
categoria** (combustível, alimentação, hotel, pedágio, manutenção, outros — lançamentos
diários; total e % sobre o recebido) · **Conferência física × sistema** (soma contada ×
soma registrada → acerto → resultado/diferença) · **comparativo com a viagem anterior** ·
**folha de comissões** (representante modelo B, gerente Y%, ajudante fixo semanal) →
gera **contas a pagar** no FIN.

### 3.6 Comissões (definidas no 02A — aqui só o gatilho)
Representante: **modelo B** — `recebido ÷ carteira` → faixa → % sobre o recebido
**líquido** da comissão do revendedor. Revendedor: **desconto no acerto** (paga já
líquido do % individual dela). Gatilho de tudo: o **fechamento da viagem**.
**Massa de teste obrigatória:** planilhas reais (96,72%→8%→R$ 3.692,91 no centavo).

### 3.7 Regra Comercial por representante
Perfil que restringe o que o app oferece em campo: **empresas, naturezas de operação,
condições de pagamento e tabelas de preço permitidas** (checkboxes). Ex. real: "Juliano
tudo, menos boleto". Tabela de preço é entidade do **VND** (02A); o ROT vincula a do
representante e a Regra Comercial delimita.

## 4. App do representante (requisitos; fatia própria)

**OFFLINE-FIRST obrigatório** (área sem sinal): opera local, sincroniza depois.
Impressão térmica portátil (comprovante + promissória; ZPL/ESC-POS compartilhado com o
EXP) **e/ou** comprovante por WhatsApp/PDF. **Reimpressão/2ª via sempre** (caso real:
acabou a bobina). Rastreamento do representante **ligado ao status da viagem** (inicia na
saída, cessa no fechamento), com consentimento explícito (LGPD).

**✅ DECIDIDO (23/08/2026, Eliab): stack do app = Ionic React + Capacitor.** Racional:
impressora térmica Bluetooth via plugin nativo, GPS em segundo plano vinculado ao status
da viagem, e SQLite local para o offline-first robusto — o PWA falharia justamente nos
três pontos críticos do dia de campo. Stack já dominada no monorepo (LouvorApp). A fatia
do app entra na fila DEPOIS da revisão do relatório da retaguarda; o primeiro passo será
a **proposta de estrutura** (app no monorepo em `apps/Veertex/mobile/`? compartilhamento
de código com o frontend web? estratégia de sync offline → propostas de dois estágios),
para aprovação antes de código.

## 5. Entidades (conceitual, inglês)

`route` · `trip` (+`trip_expense`, `trip_cash_count`) · `trip_load`/romaneio (via
movimentos EST com `location kind=rep_load`) · pedido do VND com ciclo de consignação ·
`promissory_note` · `trip_collection` (título×viagem, cobrança|recobrança) ·
`field_receipt` (recebimento em campo: título, viagem, forma, valor, juros?) ·
`commercial_rule` (regra comercial do representante) · evidências
(`order_evidence`: gps/foto tipos) · comissão: tabelas de faixa do modelo B (02A).

## 6. Ordem de fatias sugerida

1. Pré-requisito: localizações do EST (03A) entregues.
2. `route` + carteirização de revendedor (campos do contato) + Regra Comercial.
3. `trip` + carga/romaneio + ciclo do pedido consignado (backend + telas retaguarda).
4. Acerto: recebimentos, devolução, troca em par, recobrança, política "perdida".
5. Fechamento: despesas, conferência física×sistema, comparativo, folha de comissões
   (motor B com a massa de teste) → contas a pagar.
6. Evidências (GPS/fotos, MinIO) + promissória (geração/PDF/térmica).
7. App offline-first (após decisão de stack) — o backend das fatias 2–6 já serve.

## 7. Critérios de aceite

1. Pedido de rota não fecha sem passar por acerto; ciclo consignado respeitado por teste.
2. GPS do pedido imutável: edição não altera; mudança só por ação explícita auditada.
3. Título após 1+3 sem recebimento sai da carteira e permanece no FIN (limiar da conta).
4. Fechamento reproduz as planilhas reais **no centavo** (comissão B e totais).
5. Troca gera par vinculado; devolução reentra pelo custo da época (03 §3.4).
6. Regra Comercial: representante não vê/usa condição ou tabela fora do perfil — por
   teste de autorização, não por tela.
7. Isolamento (`verify:isolation`) cobre todas as tabelas novas no mesmo commit.
