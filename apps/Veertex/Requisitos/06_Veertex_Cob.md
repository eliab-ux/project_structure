# 06_Veertex_Cob.md — Módulo COB (Cobrança)

> **Versão reescrita a partir da FONTE-MÃE** (handoff: boletos/agregador, régua absorvida
> do Bling, crediário e política "perdida") — substitui o esqueleto, cujas recomendações
> §3.2/§3.4/§3.8 ficam RATIFICADAS (coincidem com o levantamento). Dependência: `COB → FIN`.

## 1. Objetivo

Transformar título a receber em cobrança ativa: emitir o instrumento (boleto/Pix),
conduzir a régua de comunicação, baixar automaticamente pelo retorno do provedor e
sustentar o **crediário** (a cobrança da rota vive no ROT — carteira/recobrança; o COB
cobre os instrumentos e a régua dos canais não-presenciais).

## 2. Decisões fechadas (respondem §3.1–§3.8 do esqueleto)

### 2.1 Instrumento e provedor (§3.1/§3.2)
**V1 via AGREGADOR de cobrança** atrás de `BillingProviderPort` — candidatos
Kobana/TecnoSpeed/Asaas (escolha final na implementação, critério: fee × cobertura ×
qualidade de API; decisão de levantamento). Instrumentos pelo agregador: **boleto
registrado** e **Pix** (dinâmico/cobrança com vencimento — a recomendação "Pix primeiro"
do esqueleto é compatível: a ordem de entrega dentro do adapter é livre). Roadmap
registrado: **API Sicoob direta** como segundo adapter (elimina fee p/ quem é Sicoob);
**CNAB 240 por arquivo só sob demanda futura**. Multi-convênio por conta/empresa.

### 2.2 Baixa automática (§3.8)
**Webhook do provedor baixa o título no FIN automaticamente, com origem registrada**
(decisão de levantamento, coincide com a recomendação do esqueleto). Idempotente
(reprocessar notificação não duplica baixa). Tarifa do evento vira conta a pagar/
lançamento com categoria própria (tarifas bancárias por evento — árvore do FIN).

### 2.3 Régua de cobrança (§3.3) — conciliada com a regra da casa
Etapas configuráveis por conta: **X dias antes / no vencimento / Y dias após** (múltiplos
"após"), canal por etapa (e-mail e WhatsApp — consome a engine de notificação do CORE),
**templates com variáveis** ([NOME], [VALOR], [VENCIMENTO], [LINK]), carta de cobrança
formal como modelo, confirmação de pagamento ao cliente. **Modo de disparo:** default =
a régua **PROPÕE na Mesa** (regra do produto); a conta pode ativar **modo automático
opt-in por etapa** (envio sem aprovação individual — é o padrão de mercado absorvido do
Bling e requisito do levantamento; a ativação do modo é a aprovação humana, registrada).
Interrupções: pagamento, renegociação, contato registrado. Histórico de envio
**append-only** (o quê, quando, canal, template) ✓.

### 2.4 Juros/multa (§3.4)
**FIN calcula; COB apresenta** — ratificado.

### 2.5 Bloqueio por inadimplência (§3.5)
**Preferência da conta** (default: bloqueia nova venda com título vencido além de N dias,
N configurável) + **exceção liberável por permissão granular** (`orders.overdue.override`)
— decidir o default fino na fatia, o desenho é este. Toca o VND: o check entra na
confirmação do pedido junto ao limite de crédito.

### 2.6 Crediário e "perdida"
Crediário (venda a prazo em parcelas — promissória/carnê) usa os títulos do FIN; o COB
fornece: carnê imprimível, visão de inadimplência por cliente, e a automação da política
**"perdida"** definida no 04 §3.4 (1 cobrança + N recobranças configurável →
`written_off_pending`; sai de régua e carteira; write-off manual no FIN). **Renegociação
(§3.6): V1 mínima** — criar títulos novos e baixar os antigos "por acordo" (lançamento
novo, origem `renegotiation`), status `renegotiated` já existe no FIN. Negativação e
protesto: **fora da V1** ✓ (§3.7).

## 3. Entidades (conceitual)

`billing_provider_config` (por conta/empresa: provedor, credenciais cifradas, convênio) ·
`charge` (instrumento emitido: título, tipo boleto|pix, ids externos, linha digitável/
qr, status, pdf key) · `dunning_rule`/`dunning_step` (régua) · `dunning_event`
(histórico append-only) · webhooks (idempotência por id externo).

## 4. Ordem de fatias

1. `BillingProviderPort` + adapter do agregador escolhido; emissão de boleto/Pix a partir
   do título; PDF no MinIO.
2. Webhook de baixa automática (FIN) + tarifas por evento.
3. Régua (config + propostas na Mesa) → modo automático opt-in.
4. Bloqueio por inadimplência (preferência + override) no fluxo do VND.
5. Carnê/crediário + automação da "perdida" + renegociação mínima.

## 5. Critérios de aceite

1. COB não ativa sem FIN (dependência) ✓.
2. Boleto/Pix emitido referencia título e empresa corretos; PDF acessível.
3. Webhook idempotente: mesma notificação duas vezes = uma baixa.
4. No modo padrão, nenhuma mensagem sai sem aprovação; no modo automático, o opt-in por
   etapa está registrado (quem ativou, quando) e o envio é auditável.
5. Título `written_off_pending` sai da régua automaticamente.
6. Histórico de cobrança append-only; zero violações do `CLAUDE.md`.
