# PLANO_DIARIO_SPEC.md

> **Documento de especificação para o Claude Code (VS Code).**
> Este arquivo é a fonte de verdade dos requisitos do sistema **Plano Diário** (nome definitivo).
> Leia-o **inteiro** antes de escrever qualquer linha de código.

---

## 0. Instruções de Execução para o Claude Code

**Leia nesta ordem, obrigatoriamente, antes de gerar código:**

1. `CLAUDE.md` na raiz do monorepo — **constituição do projeto**. Prevalece sobre este arquivo em qualquer conflito de arquitetura, segurança, padrões de código ou deploy.
2. Este arquivo (`PLANO_DIARIO_SPEC.md`) — define **o que** construir.
3. `README.md` e `PROJECT_STRUCTURE.md` — estrutura do monorepo e packages compartilhados.

**Regras de trabalho (não negociáveis):**

- **Comunicação em pt-BR.** Código, identificadores, tabelas e colunas em **inglês**. Comentários em pt-BR.
- **Desenvolvimento por fases.** Execute **uma fase por vez** (seção 9). Ao concluir uma fase, pare, apresente o que foi feito e aguarde aprovação antes de iniciar a próxima. **Não** implemente fases futuras "por adiantamento".
- **Nunca invente contrato de API externa.** Onde este documento marca `⚠️ CONFIRMAR`, você **deve** parar e pedir confirmação ao usuário (ou validar contra a instância real) antes de codificar. Não assuma versão de payload da Evolution API.
- **Security by Design** conforme `CLAUDE.md`: guard em todo endpoint protegido, `class-validator` em todo campo de request DTO, ResponseDto sempre (nunca domain entity via HTTP), zero secret hardcodado, `.env.example` atualizado a cada variável nova.
- **Antes de criar arquivo novo**, verifique se já existe equivalente no monorepo (`packages/shared-kernel`, `packages/domain-primitives`) e reutilize.
- **Após cada fase:** `npm run lint`, `npm run typecheck` e os testes da fase devem passar. Fase com lint/type error não está concluída.

---

## 1. Visão Geral do Produto

### 1.1. Problema

Existe um plano de leitura bíblica anual publicado como vídeos diários no canal do YouTube
`https://www.youtube.com/@caminhandocomharoldwalker/playlists`. Cada vídeo tem o número do dia do plano no título (ex.: `Dia 208 - Isaías 26-28`).

Hoje, alguém precisa manualmente, todos os dias, achar o vídeo do dia e postar o link em um grupo de WhatsApp. O objetivo do sistema é **automatizar 100% desse envio**.

### 1.2. Solução

Uma aplicação web onde o usuário:

1. Cria conta e faz login (autenticação própria, JWT).
2. Conecta o **seu próprio WhatsApp** lendo um QR Code — a conexão é feita através de uma instância dedicada na **Evolution API** self-hosted do projeto.
3. Escolhe, numa lista carregada do próprio WhatsApp, **qual grupo** vai receber a mensagem.
4. Define o **horário de envio** diário (e o fuso horário).
5. O sistema envia, todos os dias no horário escolhido, uma mensagem no grupo com **apenas a data e o link do vídeo do dia**.

### 1.3. Formato exato da mensagem enviada

Duas linhas. Nada mais — sem saudação, sem título do vídeo, sem emoji, sem assinatura:

```
28 de JULHO
https://youtu.be/aSi0uip5XHg
```

Regras de formatação:

- **Linha 1:** `{dia sem zero à esquerda} de {MÊS EM MAIÚSCULAS, pt-BR}`. Ex.: `1 de JANEIRO`, `28 de JULHO`, `3 de MARÇO`.
- **Linha 2:** URL curta canônica `https://youtu.be/{videoId}`.
- **Parâmetro de tracking (`?si=...`) NÃO deve ser incluído.** Ele é gerado pelo botão "Compartilhar" do YouTube, é volátil e não agrega nada. (Nota: o exemplo original trazia `?is=`, que é inválido — o parâmetro real do YouTube é `?si=`. Enviar a URL limpa elimina o problema.)
- O template é **configurável** por agendamento (campo `messageTemplate`), com placeholders `{{date}}` e `{{url}}`. Default:
  ```
  {{date}}
  {{url}}
  ```

### 1.4. Escopo — v1

**Dentro do escopo:**

- Cadastro/login de usuário (JWT próprio).
- Conexão de **um** WhatsApp por usuário (uma instância Evolution por usuário).
- Listagem de grupos do WhatsApp conectado, com refresh manual.
- Seleção de **um** grupo de destino por usuário.
- Horário de envio + timezone.
- Sincronização do catálogo de vídeos a partir do YouTube.
- Envio diário automático, idempotente, com histórico.
- Botão "Enviar agora" (teste manual).
- Ativar/pausar o envio.

**Fora do escopo da v1 (documentado como evolução futura):**

- Múltiplos grupos por usuário (o schema já prevê, a UI não expõe).
- Múltiplos WhatsApps por usuário.
- Envio do vídeo como mídia (upload) — a v1 envia **só o link em texto**.
- Planos/cobrança/assinatura.
- Área administrativa multiusuário com gestão de contas.
- Notificação ao usuário quando um envio falha (v1 apenas registra no histórico).

---

## 2. Stack e Localização no Monorepo

Stack idêntica ao padrão do `CLAUDE.md`:

| Camada | Tecnologia |
|---|---|
| Backend | **NestJS 10** + **Fastify** |
| ORM | **MikroORM 6** (driver PostgreSQL) |
| Banco | **PostgreSQL** (Supabase — sugestão padrão) |
| Auth | **JWT próprio** (`jsonwebtoken` + `bcryptjs`) |
| Filas / agendamento | **BullMQ** + **Redis** |
| HTTP client | `axios` (adapters de Evolution API e YouTube) |
| Frontend | **Next.js 14** (App Router) + **Material-UI** |
| Forms | `react-hook-form` + `yup` |
| Notificações UI | `notistack` |
| Linguagem | **TypeScript** strict |

**Localização:**

```
apps/plano-diario-system/
├── backend/       # NestJS + Fastify + MikroORM (porta 3011)
└── frontend/      # Next.js 14 + MUI (porta 3013)
```

> As portas 3011/3013 são sugestão para não colidir com o KAZATEM (3001/3003) nem com o Ecoa. `⚠️ CONFIRMAR` com o usuário se há conflito no ambiente local.

**Arquitetura:** Hexagonal (Ports & Adapters), conforme `CLAUDE.md`. Dependências apontam para dentro: `Infrastructure → Application → Domain`.

---

## 3. Bounded Contexts

```
src/contexts/
├── auth/          # registro, login, refresh, reset de senha
├── user/          # perfil do usuário
├── whatsapp/      # instância Evolution, QR, estado de conexão, grupos
├── catalog/       # playlists/vídeos do YouTube, resolução dia → vídeo
├── schedule/      # agendamento (grupo destino, horário, timezone, ativo)
└── dispatch/      # execução do envio, idempotência, histórico
```

### Responsabilidade de cada context

| Context | Responsabilidade | Não é responsável por |
|---|---|---|
| `auth` | Credenciais, emissão/validação de token | Dados de perfil |
| `whatsapp` | Ciclo de vida da instância Evolution; cache de grupos | Decidir *quando* enviar |
| `catalog` | Saber qual vídeo corresponde ao dia N | Saber que dia é hoje para um usuário |
| `schedule` | Configuração do usuário; **calcular o número do dia** | Enviar mensagem |
| `dispatch` | Montar a mensagem, enviar, registrar, garantir 1 envio/dia | Descobrir o vídeo (pede ao `catalog`) |

---

## 4. Modelo de Dados

Multi-tenancy conforme o padrão do projeto: **banco compartilhado + `user_id` em toda tabela de dado do usuário**. Toda tabela tem `created_at` e `updated_at`.

### 4.1. `users`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `email` | varchar(255) | **unique**, lowercase, index |
| `password_hash` | varchar(255) | bcrypt, cost ≥ 10 |
| `name` | varchar(120) | |
| `role` | varchar(20) | `user` \| `admin` — default `user` |
| `is_active` | boolean | default `true` |

### 4.2. `whatsapp_instances`

Uma instância Evolution por usuário.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | **unique** (1:1 na v1) |
| `instance_name` | varchar(120) | **unique**. Gerado pelo sistema: `pd_{userId sem hífens}` |
| `instance_token` | text | token/apikey devolvido pela Evolution na criação — **criptografado em repouso** (AES-256-GCM, chave em `ENCRYPTION_KEY`) |
| `status` | varchar(30) | `pending_qr` \| `connecting` \| `connected` \| `disconnected` \| `error` |
| `connected_number` | varchar(30) | nullable — número do WhatsApp conectado (só para exibir) |
| `last_status_at` | timestamptz | última atualização de estado |

### 4.3. `whatsapp_groups` (cache)

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | index |
| `instance_id` | uuid FK | |
| `group_jid` | varchar(120) | ex.: `1203630...@g.us`. **unique(user_id, group_jid)** |
| `name` | varchar(255) | |
| `participants_count` | int | nullable |
| `synced_at` | timestamptz | |

> É **cache**. A fonte de verdade é sempre a Evolution API. Sincronização sob demanda (botão "Atualizar grupos") e antes de cada envio se o cache tiver > 7 dias.

### 4.4. `daily_videos` (catálogo global)

Tabela **global** (não tem `user_id`) — o plano de leitura é o mesmo para todos.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `day_number` | int | **unique**, index. Extraído do título |
| `title` | varchar(255) | título completo do vídeo, como está no YouTube |
| `video_id` | varchar(32) | ID do vídeo (ex.: `aSi0uip5XHg`) |
| `playlist_id` | varchar(64) | playlist de origem |
| `published_at` | timestamptz | nullable |
| `synced_at` | timestamptz | |

### 4.5. `schedules`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | **unique** na v1 (um agendamento por usuário) |
| `group_jid` | varchar(120) | grupo de destino |
| `group_name` | varchar(255) | snapshot do nome, para exibir sem depender do cache |
| `send_time` | time | hora local do envio, ex.: `07:00` |
| `timezone` | varchar(64) | IANA, default `America/Sao_Paulo` |
| `plan_start_date` | date | default `2026-01-01` — dia 1 do plano |
| `day_offset` | int | default `0` — ajuste fino (ver seção 5.2) |
| `message_template` | text | default `{{date}}\n{{url}}` |
| `is_active` | boolean | default `true` |

### 4.6. `dispatch_logs`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | index |
| `schedule_id` | uuid FK | |
| `reference_date` | date | data local do envio. **UNIQUE(schedule_id, reference_date)** ← garante idempotência |
| `day_number` | int | dia do plano resolvido |
| `video_id` | varchar(32) | nullable (pode falhar antes de resolver) |
| `message_sent` | text | conteúdo exato enviado |
| `status` | varchar(20) | `pending` \| `sent` \| `failed` \| `skipped` |
| `error_reason` | text | nullable, **mensagem sanitizada** (sem token/apikey) |
| `attempts` | int | default 0 |
| `sent_at` | timestamptz | nullable |
| `trigger` | varchar(20) | `scheduled` \| `manual` |

> A constraint `UNIQUE(schedule_id, reference_date)` é o coração da idempotência. **Não** confie em lógica de aplicação para evitar envio duplicado — confie no banco. Envios manuais (`trigger = manual`) devem usar uma `reference_date` que **não** colida com o agendado (ver 7.4).

---

## 5. Regra Central: Qual vídeo enviar hoje

Esta é a regra de negócio mais importante do sistema e a que mais fácil se implementa errado. Leia com atenção.

### 5.1. ⚠️ A aritmética de data não bate com o exemplo

O usuário informou: *"hoje, dia 28/07/2026, considerando que o ano começa no dia 01/01/2026, então hoje é o dia 208"*.

Conferindo: 31 (jan) + 28 (fev) + 31 (mar) + 30 (abr) + 31 (mai) + 30 (jun) = 181 dias até 30/06. Somando 28 dias de julho → **209**. Contando `01/01` como dia 1, **28/07/2026 é o dia 209 do ano**, não 208.

Ou seja, existe um **deslocamento de −1** entre a contagem calendárica e a numeração da playlist. As causas possíveis são: o plano começou em 02/01, a playlist tem um dia faltando/duplicado, ou a numeração simplesmente foi feita com off-by-one.

**Consequência de projeto:** o sistema **NUNCA** deve montar a URL do vídeo a partir de um cálculo de data. Isso enviaria a leitura errada para o grupo — falha silenciosa e visível ao público.

### 5.2. Algoritmo obrigatório

```
1. Descobrir a data local do usuário:
   localDate = agora convertido para schedule.timezone

2. Calcular o dia candidato:
   dayNumber = diffInDays(localDate, schedule.plan_start_date) + 1 + schedule.day_offset

3. Buscar no catálogo:
   video = SELECT * FROM daily_videos WHERE day_number = dayNumber

4. Se NÃO encontrar → NÃO enviar nada.
   Registrar dispatch_log com status = 'failed',
   error_reason = 'Vídeo do dia N não encontrado no catálogo'.
   NUNCA enviar um vídeo "aproximado", nem o do dia anterior, nem um fallback.

5. Montar a mensagem com localDate e video.video_id.
```

Com `plan_start_date = 2026-01-01` e `day_offset = -1`, o dia 28/07/2026 resolve para o dia **208** — que é o esperado pelo usuário.

**Tarefa de validação (obrigatória na Fase 2):** após sincronizar o catálogo, o Claude Code deve rodar um script que imprima o vídeo resolvido para 3 datas conhecidas (incluindo 28/07/2026) e **apresentar ao usuário para conferência** antes de seguir. O valor final de `day_offset` é decidido pelo usuário com base nesse output, não pelo Claude Code.

### 5.3. Formatação da data (linha 1)

Mês em pt-BR, maiúsculas, sem acento removido:
`JANEIRO, FEVEREIRO, MARÇO, ABRIL, MAIO, JUNHO, JULHO, AGOSTO, SETEMBRO, OUTUBRO, NOVEMBRO, DEZEMBRO`

Implementar como **função pura em `catalog/domain/` ou `shared`**, sem depender de locale do sistema operacional (locale de container é fonte comum de bug). Array constante de meses. Cobertura de teste unitário para os 12 meses + dia 1 + dia 31.

---

## 6. Integração: YouTube (context `catalog`)

### 6.1. Princípio: descoberta 100% automática

**O aplicativo descobre os vídeos sozinho, lendo o canal do YouTube. Não existe cadastro manual de vídeo em nenhum momento — nem na v1, nem como fallback, nem como tela de administração.**

Consequências obrigatórias desse princípio:

- **Não existe** endpoint, tela, seed ou planilha para cadastrar/editar vídeo. `daily_videos` é populada **exclusivamente** pelo processo de sync.
- O usuário informa apenas o **handle do canal** (configurável por env, default `caminhandocomharoldwalker`). Nada mais.
- O sistema varre **todas as playlists do canal** e **todos os vídeos de cada playlist**, sem lista fixa de playlists hardcoded. Se o autor criar uma playlist nova amanhã, a sync do dia seguinte já a inclui.
- A extração do número do dia vem **do título do vídeo**, não da posição na playlist (playlists podem ser reordenadas).
- Novos vídeos publicados depois do primeiro sync entram automaticamente na próxima varredura.

### 6.2. O que varrer

Canal: `https://www.youtube.com/@caminhandocomharoldwalker/playlists`

Duas fontes cobrem o canal inteiro; varrer **as duas** e unificar por `videoId`:

1. **Uploads do canal** — a playlist especial `uploads` (`channels.list → contentDetails.relatedPlaylists.uploads`) contém *todo* vídeo publicado, inclusive os que não estão em nenhuma playlist.
2. **Playlists públicas do canal** — para preencher `playlist_id` e cobrir vídeos que porventura não apareçam em uploads.

Varrer só as playlists deixaria de fora vídeos soltos; varrer só uploads perderia a informação de playlist. Por isso, as duas.

### 6.3. Adapter primário — YouTube Data API v3

Padrão do sistema. API key simples (conteúdo público, **sem OAuth**, sem consentimento do usuário).

1. `channels.list?part=contentDetails&forHandle={handle}` → `channelId` + `relatedPlaylists.uploads`.
2. `playlistItems.list?part=snippet,contentDetails&playlistId={uploadsId}&maxResults=50` — paginar com `pageToken` até esgotar.
3. `playlists.list?part=snippet&channelId={channelId}&maxResults=50` — paginar.
4. Para cada playlist: `playlistItems.list` paginado.
5. Deduplicar por `videoId`, unindo o `playlistId` encontrado.

**Extração do número do dia**, aplicada ao título:

```
/\bdia\s*0*(\d{1,3})\b/i
```

- Título sem match → **ignorar** o vídeo (log `warn`, contabilizado como `skipped`; não é erro).
- Aceitar variações de espaçamento e zeros à esquerda (`Dia 7`, `Dia 007`, `DIA 208 -`).
- `⚠️` Se a taxa de `skipped` passar de **10%** do total, **abortar o upsert** e reportar ao usuário: significa que o padrão de título mudou e o regex precisa de ajuste. Sincronizar um catálogo pela metade é pior que não sincronizar.

**Upsert** em `daily_videos` por `day_number`. Conflito (dois vídeos com o mesmo dia) → manter o de `publishedAt` mais recente e **logar o conflito** no relatório de sync.

**Quota:** `playlistItems.list` e `playlists.list` custam 1 unidade por chamada. Um canal com ~366 vídeos consome ~20 unidades por sync completo, contra um limite diário de 10.000. Sincronizar 1x/dia é folgadíssimo.

### 6.4. Adapter de fallback — leitura direta das páginas do canal

Caso o usuário não queira criar chave no Google Cloud, implementar um segundo adapter que lê as páginas públicas do canal e extrai o JSON embutido `ytInitialData` (`/@{handle}/videos` e `/@{handle}/playlists`, seguindo os tokens de continuação para paginar).

Trade-off a deixar claro ao usuário: **funciona sem chave, mas é frágil** — o YouTube muda a estrutura da página sem aviso e sem versionamento. A API v3 é contratual.

Regra: os dois adapters implementam o **mesmo port** e são selecionados por env `CATALOG_SOURCE=youtube_api | channel_scrape`. Default `youtube_api`. **Não** implementar o fallback na Fase 2 — só se o usuário pedir.

> **Não usar o feed RSS do canal** para o catálogo. Ele devolve apenas os ~15 vídeos mais recentes, insuficiente para um plano de 366 dias.

### 6.5. Port e adapter

```typescript
// contexts/catalog/application/ports/output/video-source.port.ts
export const VIDEO_SOURCE = Symbol('VIDEO_SOURCE');

export interface SourceVideo {
  videoId: string;
  title: string;
  playlistId: string;
  publishedAt: Date | null;
}

export interface VideoSourcePort {
  fetchAllChannelVideos(): Promise<SourceVideo[]>;
}
```

Adapters: `infrastructure/youtube/youtube-data-api.adapter.ts` (primário) e, se solicitado, `infrastructure/youtube/channel-scrape.adapter.ts`.
A escolha da fonte fica **isolada atrás do port** — se a quota, a API ou o HTML mudarem, troca-se o adapter sem tocar em nenhum use case nem no domínio.

### 6.6. Quando a sincronização acontece

Três gatilhos, todos automáticos ou administrativos — **nenhum depende de intervenção manual rotineira**:

| Gatilho | Quando | Observação |
|---|---|---|
| **Bootstrap** | No startup da aplicação, se `daily_videos` estiver vazia | Enfileira a sync imediatamente. Garante que uma instalação nova se popule sozinha, sem comando manual |
| **Diário** | Job BullMQ repeatable `catalog-sync`, **03:00 America/Sao_Paulo** | Captura vídeos novos e correções de título |
| **Sob demanda (auto-corretiva)** | No `dispatch-send`, quando o `day_number` de hoje **não** existe no catálogo | Ver regra abaixo |
| Administrativo | `POST /api/admin/catalog/sync` (`AdminGuard`) | Para diagnóstico, não para operação normal |

**Regra da sync sob demanda** (refina a seção 5.2, passo 4): se o vídeo do dia não estiver no catálogo, o job dispara **uma única** sync com timeout de 60s e tenta resolver novamente. Se ainda não achar, então sim registra `failed`. Isso torna o sistema auto-corretivo quando o autor publica o vídeo tarde, sem transformar rede externa em dependência do caminho crítico — no caso normal (catálogo em dia) **nenhuma** chamada ao YouTube acontece durante o envio.

**Sync com falha nunca destrói dados.** É upsert, não replace: se a varredura falhar no meio, o catálogo anterior continua íntegro e válido. Não existe `DELETE FROM daily_videos` em nenhum ponto do código.

**Relatório de sync** (retornado pelo endpoint admin e logado a cada execução):
```json
{
  "playlistsScanned": 12,
  "videosFound": 371,
  "imported": 366,
  "updated": 4,
  "skippedNoDayNumber": 5,
  "conflicts": [{ "dayNumber": 42, "kept": "abc123", "discarded": "def456" }],
  "durationMs": 8420
}
```

### 6.7. Variáveis de ambiente

```env
CATALOG_SOURCE=youtube_api          # youtube_api | channel_scrape
YOUTUBE_API_KEY=
YOUTUBE_CHANNEL_HANDLE=caminhandocomharoldwalker
CATALOG_SYNC_CRON=0 3 * * *
CATALOG_SKIP_RATE_ABORT_THRESHOLD=0.10
```

---

## 7. Integração: Evolution API (context `whatsapp`)

### 7.1. ⚠️ Confirmação obrigatória antes de codificar

A Evolution API tem diferenças **quebrantes** de contrato entre v1 e v2 (o envio de texto, por exemplo, mudou de `{ textMessage: { text } }` para `{ text }`). Antes de implementar o adapter, o Claude Code **deve**:

1. Perguntar ao usuário: **URL base da Evolution API**, **versão** (`GET /` na raiz retorna a versão) e a **API key global**.
2. Confirmar os endpoints reais na documentação da versão em uso.
3. **Só então** escrever o adapter.

Não presuma. Um payload errado aqui resulta em falha silenciosa de envio.

### 7.2. Operações necessárias (nomes sujeitos à confirmação da versão)

| Operação | Endpoint típico | Uso no sistema |
|---|---|---|
| Criar instância | `POST /instance/create` | ao usuário clicar "Conectar WhatsApp" |
| Obter QR / conectar | `GET /instance/connect/{instance}` | exibir QR na tela |
| Estado da conexão | `GET /instance/connectionState/{instance}` | polling / badge de status |
| Listar grupos | `GET /group/fetchAllGroups/{instance}?getParticipants=false` | tela de seleção de grupo |
| Enviar texto | `POST /message/sendText/{instance}` | envio diário |
| Logout | `DELETE /instance/logout/{instance}` | desconectar |
| Excluir instância | `DELETE /instance/delete/{instance}` | remover conexão |

Autenticação: header `apikey`. Corpo de criação inclui `instanceName`, `integration: 'WHATSAPP-BAILEYS'`, `qrcode: true`.
No envio, `number` recebe o **JID do grupo** (`...@g.us`), não um telefone.

### 7.3. Port e adapter

```typescript
// contexts/whatsapp/application/ports/output/whatsapp-gateway.port.ts
export const WHATSAPP_GATEWAY = Symbol('WHATSAPP_GATEWAY');

export interface WhatsappGroup {
  jid: string;
  name: string;
  participantsCount: number | null;
}

export interface InstanceConnection {
  status: 'pending_qr' | 'connecting' | 'connected' | 'disconnected' | 'error';
  qrCodeBase64?: string;
  pairingCode?: string;
  connectedNumber?: string;
}

export interface WhatsappGatewayPort {
  createInstance(instanceName: string): Promise<{ token: string }>;
  connect(instanceName: string): Promise<InstanceConnection>;
  getConnectionState(instanceName: string): Promise<InstanceConnection>;
  listGroups(instanceName: string): Promise<WhatsappGroup[]>;
  sendText(instanceName: string, jid: string, text: string): Promise<{ providerMessageId: string }>;
  logout(instanceName: string): Promise<void>;
  deleteInstance(instanceName: string): Promise<void>;
}
```

Adapter: `infrastructure/whatsapp/evolution-api.adapter.ts`.

**Regras do adapter:**

- Timeout de **10s** em toda chamada; **2 retries** com backoff exponencial apenas em erro de rede/5xx. **Nunca** retry em 4xx.
- `⚠️ Nunca logar a apikey nem o token da instância.` Interceptor de log deve mascarar headers `apikey`/`Authorization`.
- Erros da Evolution são traduzidos em exceções de domínio tipadas (`WhatsappNotConnectedException`, `WhatsappSendFailedException`) — o cliente **nunca** vê a mensagem crua do provider.

### 7.4. Fluxo de conexão (UX)

```
Usuário clica "Conectar WhatsApp"
  → POST /api/whatsapp/instance
  → backend: cria instância na Evolution, salva instance_name + token criptografado, status = pending_qr
  → retorna QR em base64
  → frontend exibe QR e faz polling de GET /api/whatsapp/instance/status a cada 3s (máx. 2 min)
  → usuário escaneia no celular
  → status muda para 'connected', frontend avança para a seleção de grupo
```

**QR expira** (~60s na Evolution). A tela precisa de botão **"Gerar novo QR"** que rechama `connect`.

**Webhook (recomendado, não obrigatório na v1):** `POST /api/webhooks/evolution/:instanceName` para eventos `QRCODE_UPDATED` e `CONNECTION_UPDATE`, evitando polling. Endpoint **público** (não recebe JWT) e portanto:
- deve validar um **token secreto no path ou header** (`EVOLUTION_WEBHOOK_TOKEN`);
- deve ter comentário explicando por que não tem guard, conforme regra do `CLAUDE.md`;
- deve ser idempotente e nunca lançar erro para o provider (sempre 200).

### 7.5. Variáveis de ambiente

```env
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=
EVOLUTION_WEBHOOK_TOKEN=
ENCRYPTION_KEY=            # 32 bytes hex — AES-256-GCM do instance_token
```

---

## 8. Agendamento e Envio (context `dispatch`)

### 8.1. Estratégia do scheduler

**Não** criar um repeatable job por usuário (fica difícil de reconciliar quando o usuário muda o horário). Em vez disso:

```
Um único repeatable job BullMQ: 'dispatch-tick'
  cron: '* * * * *'  (a cada minuto)
  ↓
  Para cada schedule com is_active = true:
    localNow  = agora no schedule.timezone
    localDate = data de localNow
    Se localNow.HH:mm === schedule.send_time  (comparação por minuto)
      → enfileirar job 'dispatch-send' { scheduleId, referenceDate: localDate }
```

Vantagens: suporta qualquer timezone corretamente, tolera restart do processo, muda de horário sem reconciliar filas, e a idempotência fica no banco.

**Job `dispatch-send` (concorrência 5, 3 tentativas, backoff exponencial):**

```
1. INSERT em dispatch_logs (schedule_id, reference_date, status='pending')
   → se violar a UNIQUE constraint, ABORTAR silenciosamente (já foi enviado hoje). Não é erro.
2. Carregar schedule + instância. Se instância != 'connected'
   → status='failed', error_reason='WhatsApp não conectado'. Fim.
3. Resolver dayNumber e vídeo (seção 5.2). Não achou → status='failed'. Fim.
4. Montar a mensagem a partir do template.
5. Enviar via WhatsappGatewayPort.sendText.
6. Sucesso → status='sent', sent_at=now, message_sent=<texto>.
   Falha  → attempts++, status='failed', error_reason sanitizado. BullMQ faz o retry;
            o retry reutiliza a MESMA linha de log (não cria nova).
```

**Tolerância a downtime:** se o processo estava fora no minuto exato, o envio do dia é perdido. Para cobrir isso, o `dispatch-tick` deve, além da comparação por minuto, disparar **catch-up**: se `localNow > send_time` no mesmo dia local e não existe `dispatch_log` com status `sent` para `(schedule_id, localDate)`, enfileirar o envio. Limitar o catch-up a uma janela de **3 horas** após o horário — depois disso, marcar como `skipped` e não enviar (mandar a leitura do dia às 23h não faz sentido).

### 8.2. Envio manual ("Enviar agora")

- Endpoint `POST /api/dispatch/send-now`, guard `JwtAuthGuard`.
- Cria log com `trigger='manual'` e `reference_date` = data local (para não colidir com o agendado, usar coluna `trigger` fora da unique — ou seja, a UNIQUE deve ser **parcial**: `UNIQUE(schedule_id, reference_date) WHERE trigger = 'scheduled'`).
- **Rate limit: 3 envios manuais por usuário por hora.** Sem isso, o grupo leva spam.
- Confirmação explícita no frontend antes de disparar ("Isto vai enviar a mensagem no grupo X agora. Confirmar?").

### 8.3. Variáveis de ambiente

```env
REDIS_HOST=
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=
DEFAULT_TIMEZONE=America/Sao_Paulo
CATALOG_SYNC_CRON=0 3 * * *
DISPATCH_CATCHUP_WINDOW_HOURS=3
```

---

## 9. Fases de Implementação

Execute **uma fase por vez**. Ao final de cada uma, apresente o resultado e aguarde aprovação.

### Fase 0 — Bootstrap
- Criar `apps/plano-diario-system/{backend,frontend}` seguindo a estrutura do `system-example`.
- `package.json`, `tsconfig.json` (extends base + paths), `nest-cli.json`, `.env.example`, `mikro-orm.config.ts`.
- `main.ts` com Fastify, `setGlobalPrefix('api')`, `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`), `GlobalExceptionFilter`, CORS por `CORS_ORIGIN`.
- `/api/health` público (com comentário justificando ausência de guard).
- **Aceite:** `npm run dev` sobe, `GET /api/health` responde 200.

### Fase 1 — Auth + User
- Contexts `auth` e `user`; entidades de domínio, VOs (`Email`, `UserId`), use cases: `RegisterUser`, `Login`, `RefreshToken`, `GetMe`.
- `JwtAuthGuard`, `AdminGuard`, `TokenServicePort` + implementação `jsonwebtoken`.
- Migration `users`.
- Testes: registro duplicado → 400; senha errada → 401; rota protegida sem token → 401; token de `user` em rota admin → 403.
- **Aceite:** fluxo completo registro → login → `/api/auth/me` funcionando.

### Fase 2 — Catálogo YouTube (descoberta automática)
- Context `catalog`, port `VideoSourcePort`, adapter YouTube Data API v3 (varrendo uploads **e** playlists, seção 6.2/6.3).
- Use cases: `SyncCatalog`, `GetVideoByDay`, `ResolveVideoForDate`.
- Migration `daily_videos`. **Sem seed, sem CRUD de vídeo** — a tabela só é escrita pela sync.
- Bootstrap no startup (sync se a tabela estiver vazia) + job diário `catalog-sync`.
- Função pura de formatação de data pt-BR + testes dos 12 meses.
- Testes: paginação de playlist com > 50 itens; título sem "Dia N" é ignorado; conflito de `day_number` mantém o mais recente; taxa de skip > 10% aborta o upsert; sync com falha de rede preserva o catálogo anterior.
- **Executar a sync real contra o canal** e apresentar ao usuário o relatório da seção 6.6 completo, mais: faixa de `day_number` encontrada (mín/máx), **lista dos dias faltando** dentro dessa faixa, títulos ignorados, e o vídeo resolvido para 28/07/2026 com `day_offset` 0 e −1.
- **Aceite:** usuário confirma o `day_offset` correto. **Não avance sem essa confirmação.**

### Fase 3 — Conexão WhatsApp
- `⚠️ Primeiro:` confirmar URL/versão/apikey da Evolution com o usuário.
- Context `whatsapp`, port `WhatsappGatewayPort`, adapter Evolution.
- Criptografia AES-256-GCM do `instance_token`.
- Use cases: `CreateInstance`, `GetQrCode`, `GetConnectionState`, `Disconnect`, `DeleteInstance`.
- Migration `whatsapp_instances`.
- **Aceite:** QR gerado, escaneado no celular real, status vira `connected`.

### Fase 4 — Grupos
- Use cases: `SyncGroups`, `ListGroups`. Migration `whatsapp_groups`.
- **Aceite:** `GET /api/whatsapp/groups` devolve os grupos reais do WhatsApp conectado.

### Fase 5 — Agendamento
- Context `schedule`. Use cases: `GetSchedule`, `UpsertSchedule`, `ToggleSchedule`.
- Validação: `send_time` formato `HH:mm`; `timezone` IANA válido; `group_jid` deve existir no cache de grupos do usuário; `message_template` obrigatoriamente contém `{{url}}`.
- Migration `schedules`.
- **Aceite:** configuração salva e recuperada corretamente.

### Fase 6 — Dispatch + Scheduler
- Context `dispatch`, BullMQ (`dispatch-tick`, `dispatch-send`, `catalog-sync`), migration `dispatch_logs` com a unique parcial.
- Use cases: `ExecuteDispatch`, `SendNow`, `ListDispatchHistory`.
- Testes: idempotência (dois `dispatch-send` para o mesmo dia → 1 envio); vídeo não encontrado → `failed`, nada enviado; instância desconectada → `failed`; timezone diferente → hora correta; catch-up dentro e fora da janela.
- **Aceite:** envio real chegando no grupo de teste no horário configurado, com o formato exato de duas linhas.

### Fase 7 — Frontend
Páginas (Next.js 14 App Router + MUI, pt-BR na UI):

| Rota | Conteúdo |
|---|---|
| `/login`, `/registrar` | formulários `react-hook-form` + `yup` |
| `/` (dashboard) | status da conexão, grupo destino, horário, próximo envio, vídeo de hoje, últimos 5 envios |
| `/whatsapp` | QR code, polling de status, botões "Gerar novo QR" / "Desconectar" |
| `/configuracao` | select de grupo (com "Atualizar grupos"), time picker, timezone, template, switch ativo/pausado, "Enviar agora" com confirmação |
| `/historico` | tabela paginada de `dispatch_logs` com status colorido e motivo do erro |

- `src/services/api.ts` com interceptor JWT obrigatório; base relativa `/api`.
- HTML semântico, `role="status"` em loading, `role="alert"` em erro, sem cor hardcoded (usar `theme.palette`).
- **Aceite:** fluxo completo ponta a ponta pela UI, sem tocar em Postman.

### Fase 8 — Deploy
Seguir o **playbook Dokploy do `CLAUDE.md`** (servidor mdantas). Perguntar ao usuário o *project* do Dokploy e o subdomínio antes de começar. Dockerfiles monorepo-aware (`node:22-alpine`, Docker Context Path `/`), Redis como serviço, DNS Cloudflare A → `72.61.43.90` com nuvem **cinza**, variáveis na UI do Dokploy.

---

## 10. Contrato de API (backend)

Todos os endpoints têm prefixo `/api`. Todos exigem `JwtAuthGuard` **exceto** os marcados como públicos.

### Auth
```
POST   /auth/register            público   { email, name, password }
POST   /auth/login               público   { email, password } → { accessToken, refreshToken, user }
POST   /auth/refresh             público   { refreshToken }
GET    /auth/me                            → UserResponseDto
```

### WhatsApp
```
POST   /whatsapp/instance                  cria instância → { status, qrCodeBase64? }
GET    /whatsapp/instance                  → InstanceResponseDto
GET    /whatsapp/instance/qrcode           → { qrCodeBase64, expiresInSeconds }
GET    /whatsapp/instance/status           → { status, connectedNumber? }
DELETE /whatsapp/instance                  204
POST   /whatsapp/instance/logout           204
GET    /whatsapp/groups?refresh=true       → GroupResponseDto[]
```

### Catálogo
```
GET    /catalog/today                      → { dayNumber, title, videoId, url, formattedDate }
GET    /catalog/day/:dayNumber             → VideoResponseDto
POST   /admin/catalog/sync       AdminGuard → { imported, skipped, conflicts }
```

### Agendamento
```
GET    /schedule                           → ScheduleResponseDto
PUT    /schedule                           upsert
PATCH  /schedule/toggle                    { isActive }
```

### Dispatch
```
GET    /dispatch/history?page&limit        → PaginatedResult<DispatchLogResponseDto>
POST   /dispatch/send-now                  rate-limited → DispatchLogResponseDto
```

### Webhook
```
POST   /webhooks/evolution/:instanceName   público (valida EVOLUTION_WEBHOOK_TOKEN)
```

**Nenhum ResponseDto** pode conter `passwordHash`, `instanceToken`, apikey ou qualquer secret. `instanceToken` **nunca** sai do backend.

---

## 11. Checklist de Segurança (validar ao fim de cada fase)

- [ ] Todo endpoint protegido tem guard; público tem comentário justificando
- [ ] Todo campo de request DTO tem decorator `class-validator`
- [ ] Nenhum ResponseDto expõe secret; `static fromDomain()` mapeia explicitamente
- [ ] `instance_token` criptografado em repouso; nunca logado; nunca retornado via HTTP
- [ ] `apikey` da Evolution mascarada nos logs do interceptor axios
- [ ] `error_reason` em `dispatch_logs` sanitizado (sem token, sem URL com credencial)
- [ ] Nenhum secret hardcodado; toda env nova está no `.env.example`
- [ ] `group_jid` recebido do cliente é **validado contra o cache de grupos do usuário** — nunca enviar para um JID arbitrário fornecido no body
- [ ] Rate limit no `send-now`
- [ ] `userId` sempre extraído do JWT, nunca do body/query
- [ ] Queries só via MikroORM (ou `em.getKnex().raw` com placeholders `?`)

---

## 12. Riscos Conhecidos

| Risco | Mitigação |
|---|---|
| **Off-by-one no número do dia** | `day_offset` configurável + validação humana obrigatória na Fase 2 + nunca usar fallback de vídeo |
| **Divergência de versão da Evolution API** | Confirmar versão antes de codificar; toda chamada atrás de port; adapter isolado |
| **WhatsApp desconecta sozinho** (comum em Baileys) | Verificação de status antes do envio; log `failed` explícito; badge de status no dashboard. *(Evolução futura: alertar o usuário por e-mail.)* |
| **Ban do número pelo WhatsApp** | 1 mensagem/dia em 1 grupo é uso de baixíssimo risco; rate limit no envio manual; documentar que é conta pessoal do usuário, não API oficial |
| **Playlist do YouTube reorganizada / vídeo removido** | Sync diária; conflito de `day_number` logado; catálogo antigo preservado se a sync falhar |
| **YouTube muda de handle/estrutura** | Port `VideoSourcePort` permite trocar a estratégia (API → RSS → scraping) sem tocar no domínio |
| **Duplicidade de envio** | Constraint UNIQUE no banco, não lógica de aplicação |

---

## 13. Perguntas a Resolver com o Usuário Antes da Fase 3

O Claude Code deve fazer estas perguntas **explicitamente**:

1. **Evolution API:** URL base, versão e API key global.
2. **Portas locais:** 3011 (backend) / 3013 (frontend) estão livres?
3. **Banco:** Supabase novo ou PostgreSQL self-hosted no mdantas?
4. **YouTube API key:** já existe ou precisa ser criada no Google Cloud Console?
5. **`day_offset`:** confirmar após o output da Fase 2.
6. **Deploy:** qual *project* do Dokploy e qual subdomínio?

---

**Fim da especificação.** Em caso de conflito com o `CLAUDE.md`, o `CLAUDE.md` prevalece.
