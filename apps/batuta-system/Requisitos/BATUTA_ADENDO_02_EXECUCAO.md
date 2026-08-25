# BATUTA — Adendo 02: correções de execução do despacho

> **Leia junto com `BATUTA_SPEC.md` e `BATUTA_ADENDO_01_PRESENCA.md`.**
> Este adendo corrige comportamento da **Fase 7 (Despacho)** e ajusta a prévia da
> **Fase 6**. Aplique **junto** com o Adendo 01 — os dois tocam o mesmo worker, e aplicar
> só um deles deixa o sistema num estado pior que o atual (ver §1.4).

Itens em ordem de prioridade. P0 é bug com consequência real.

---

## 1. [P0] Guard de intervalo em tempo de execução

### 1.1 O problema

O espaçamento entre envios do mesmo canal está expresso **apenas** no `delay` do job
BullMQ, calculado no planejamento. Isso é uma promessa que só vale enquanto a fila nunca
atrasa.

Quando o worker fica fora do ar — deploy, restart, queda, e com Dokploy isso é rotina —
os jobs vencem e se acumulam. Ao voltar, todos estão prontos ao mesmo tempo.

**Concorrência 1 não resolve isso.** Ela serializa, mas não espaça: com 1–2s por envio,
100 jobs acumulados saem em **um a cada 1–2 segundos**. O intervalo de 45–120s do canal é
perdido, e o chip toma uma rajada de 100 mensagens em três minutos — exatamente o padrão
que o intervalo existe para evitar.

A justificativa registrada hoje no código (`concurrency = 1` para impedir rajada pós-restart)
está incorreta e deve ser substituída pelo que segue.

### 1.2 A correção

O espaçamento precisa ser garantido **em tempo de execução**, não só no planejamento.
Implemente uma das duas opções — a primeira é preferível por ser explícita e testável:

**Opção A — guard por `last_send_at` (recomendada)**

Antes de enviar, dentro do worker:

```
minInterval = intervalo mínimo configurado do canal
elapsed     = agora - channels.last_send_at

se elapsed < minInterval:
    reagenda o próprio job para (minInterval - elapsed) + jitter curto
    → job.moveToDelayed(Date.now() + espera)
    → lança DelayedError  (não conta como falha, não incrementa attempts)
    return
```

Requisitos:
- a leitura de `last_send_at` e a marcação de "vou enviar" precisam ser **atômicas** por
  canal (`SELECT ... FOR UPDATE` na linha do canal, ou lock Redis por `channel_id`),
  senão dois workers passam pelo guard ao mesmo tempo
- `last_send_at` é atualizado **no envio bem-sucedido**
- reagendamento por guard **não** incrementa `attempts`, **não** conta para o circuit
  breaker e **não** entra no `failure_rate` do throttle

**Opção B — `limiter` com `group` por canal**

Usar o rate limiter agrupado do BullMQ, com `group = channel_id` e a taxa do intervalo
mínimo. É menos código, mas o espaçamento fica implícito na configuração da fila e é mais
difícil de testar. Se escolher esta, escreva ainda assim o teste de backlog da §1.5.

### 1.3 Concorrência deixa de ser o mecanismo de pacing

Com o guard em runtime, o espaçamento não depende mais da concorrência. Concorrência
passa a ser só uma decisão de vazão do worker, e pode subir com segurança se o gargalo de
mídia (§2) justificar.

**Mantenha concorrência 1 por enquanto**, mas registre no código que o motivo agora é
simplicidade operacional, não pacing.

### 1.4 Por que aplicar junto com o Adendo 01

A fase de presença acrescenta ~10s de ocupação por job. Sem o guard, um backlog passa a
ser drenado a ~11s por mensagem em vez de 1–2s — parece melhor, mas continua muito abaixo
dos 45–120s, e agora com o worker ocupado o tempo todo. Aplicar o Adendo 01 sozinho
degrada a situação em vez de melhorar.

### 1.5 Testes obrigatórios

- **Backlog:** 100 dispatches do mesmo canal com `scheduled_at` no passado → os envios
  saem espaçados pelo intervalo mínimo, **não** em rajada
- backlog de canais diferentes → cada canal espaçado no seu ritmo, canais em paralelo
- guard reagendando não incrementa `attempts` nem dispara circuit breaker
- dois workers concorrentes no mesmo canal → apenas um passa o guard por janela

---

## 2. [P1] Mídia por URL pré-assinada, não base64

### 2.1 O problema

Hoje cada envio com mídia lê os bytes do MinIO e monta um POST em base64. Consequências:

- base64 infla ~33%: um vídeo de 16 MB vira ~21 MB no corpo da requisição
- o worker fica ocupado durante toda a transferência, atrasando os demais canais
- risco de estourar limite de corpo sem mensagem de erro clara

### 2.2 A correção

A maioria das versões da Evolution aceita **URL** no campo de mídia, em vez de base64.
Passe a gerar uma **URL pré-assinada do MinIO** e enviar a URL.

Ganho: elimina leitura de arquivo, conversão base64 e ocupação do worker.

**Confirme antes de implementar:**
1. a versão da Evolution em uso aceita URL no endpoint de mídia
2. o container da Evolution **alcança o endpoint do MinIO pela rede** (no Dokploy,
   provavelmente pela rede interna — use o host interno, não o público)
3. o **TTL da URL pré-assinada cobre a janela de envio** com folga. Um dispatch agendado
   para daqui a 3 dias com URL de 1h de validade falha no envio. Gere a URL **no momento
   do despacho**, nunca no planejamento.

**Fallback:** se qualquer uma das três não se confirmar, mantenha base64 e trate o §2.3.

### 2.3 `bodyLimit` do Fastify

Independente da decisão acima: o default do Fastify é **1 MB**. O upload de mídia da
Fase 4 usa base64 em JSON e estoura esse limite sem erro legível.

Configure `bodyLimit` explicitamente no bootstrap do adapter Fastify, com valor coerente
com o tamanho máximo de mídia aceito, e valide o tamanho **antes** de processar, com
mensagem clara ao usuário.

---

## 3. [P2] Prévia deve informar qual teto está amarrando

### 3.1 O problema

A prévia (§9.3 do spec) informa a estimativa de conclusão em dias, mas não diz **qual
limite** produziu essa estimativa. Quatro tetos se aplicam em cascata: horário permitido,
cota do canal, máximo por hora, teto diário da conta.

Sem isso, o cliente adiciona um chip esperando mais vazão, não vê ganho nenhum — porque o
teto da conta é que estava amarrando — e conclui que o sistema está quebrado.

### 3.2 A correção

A prévia passa a retornar o **teto amarrante** (`binding_constraint`), com valor e
sugestão de ação:

| Valor | Significado | Ação sugerida ao usuário |
|---|---|---|
| `ACCOUNT_CEILING` | teto diário da conta | falar com o suporte / revisar plano |
| `CHANNEL_QUOTA` | cota dos canais somada | adicionar canal, ou aguardar a rampa |
| `HOURLY_CAP` | máximo por hora | ampliar a janela diária |
| `WINDOW` | janela é curta demais | estender `window_end` |
| `QUIET_HOURS` | horário permitido estreito | ampliar horário permitido |

Exibir na UI junto da estimativa em dias, em linguagem direta:
*"Limitado pelo teto diário da conta (100/dia). Adicionar canais não aumenta a vazão."*

### 3.3 Provisionamento do teto da conta

`accounts.daily_send_ceiling` nasceu no spec como **controle de abuso de plataforma**,
não como limite operacional do cliente.

**Provisione-o acima da capacidade realista da frota do tenant.** Teto apertado
transforma um controle de segurança em bug percebido. O teto deve morder quando o
comportamento é anômalo, não no uso normal.

---

## 4. [P3] Máximo por hora: formalizar

O valor de **30/hora por canal** foi escolhido pelo agente durante a implementação e não
consta do spec.

Na prática não amarra (30 × 13h de janela = 390/dia, acima do teto sugerido de 150/dia),
então é inofensivo hoje. Mas:

1. mova o valor para **configuração**, com o mesmo tratamento de `quota_floor` /
   `quota_ceiling` — não deixe hardcoded
2. registre como **decisão pendente 19**, sugestão 30/hora
3. exponha em `binding_constraint` como `HOURLY_CAP` (§3.2)

### Regra de processo — reforçar com o agente

Valor numérico que afeta comportamento e não está no spec **não vira default silencioso**.
Marque `// DECISÃO PENDENTE` e reporte na entrega da fase, conforme §14 do spec. Este caso
foi inofensivo; o próximo pode não ser.

---

## 5. Fora deste adendo — não implementar

- **Segmentação de contato por engajamento** (`engagement_tier`, contato quente/frio,
  chip em aquecimento enviando só para contato engajado). Retirado do escopo por decisão
  do product owner: o sistema é de envio, não de qualificação de base.
- **Rede de aquecimento entre chips próprios** (números da frota conversando entre si para
  fabricar histórico).
- Tudo que a §2 do spec exclui por princípio continua excluído.

> **Não confundir com o throttle adaptativo.** O throttle da §2.1 do spec
> (`quota_floor` / `quota_ceiling`, `RAISE|HOLD|LOWER|PAUSE` por sinal medido) **permanece
> em vigor** — é controle de vazão por qualidade medida, não segmentação de público.
> O campo `warmup_started_at` e a rampa de cota continuam como estão.

---

## 6. Decisões pendentes acrescentadas

| # | Decisão | Fase | Sugestão |
|---|---|---|---|
| 19 | Máximo de envios por hora por canal | 7 | 30/hora |
| 20 | Mídia por URL pré-assinada ou base64 | 7 | URL, se as 3 checagens da §2.2 passarem |
| 21 | `bodyLimit` do Fastify | 0 | coerente com o tamanho máximo de mídia |
| 22 | TTL da URL pré-assinada do MinIO | 7 | gerar no despacho, TTL curto |

---

## 7. Ordem de aplicação sugerida

1. §1 — guard de intervalo (P0, corrige o comportamento errado)
2. Adendo 01 completo — fase de presença e filas por canal
3. §2 — mídia por URL + `bodyLimit`
4. §3 e §4 — prévia e formalização do teto horário

Entregar com relatório e aguardar aprovação, conforme §16 do spec.
