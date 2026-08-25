# HISTÓRICO — Batuta / Claude Code

> Documento de passagem de contexto. Foi escrito para que uma sessão **sem nenhum
> histórico** consiga retomar o trabalho sem refazer descobertas.
> Última atualização: **08/08/2026**. Último commit descrito: `425fe8d`.

---

## 0. Leia isto primeiro — as três coisas que mais custam tempo

1. **Existem DOIS diretórios de trabalho e eles não são o mesmo repositório.**
   O código é editado em `C:\HD\Eliab\KAZATEM\apps\batuta-system\` (monorepo KAZATEM,
   remoto GitHub `eliab-ux/project_structure`, onde o Batuta está **untracked**), e o
   que vai para produção é `C:\HD\Eliab\batuta\` (repo próprio, GitLab
   `git@gitlab.com:eliab1/batuta.git`, branch `main`), de onde o Dokploy faz o build.
   **Toda alteração precisa ser copiada de um para o outro antes do commit.** Esquecer
   isso significa testar local com sucesso e subir a versão antiga.

2. **Migrations NÃO rodam no boot do container.** É decisão registrada no Dockerfile:
   com duas réplicas, dois processos aplicariam o mesmo lote ao mesmo tempo. Todo deploy
   que traz migration exige, no terminal do container do backend:
   ```sh
   cd /repo/apps/batuta-system/backend && npm run migrate:prod
   ```
   O sintoma de esquecer é característico: **leitura funciona e escrita dá 500**. O
   MikroORM lê com `select "c0".*` (a coluna nova não é citada) e escreve citando a
   coluna pelo nome. Já aconteceu uma vez, com `contents.include_source_url`.

3. **Segredos ficam SÓ na aba Environment do Dokploy.** Nunca em arquivo versionado,
   nunca neste documento. Isso vale para `DATABASE_URL`, senha do Redis, senha do MinIO,
   `EVOLUTION_API_KEY`, `EVOLUTION_SYSTEM_APIKEY` e `EVOLUTION_WEBHOOK_TOKEN`. Se algum
   vazar, rotacionar no serviço de origem.

---

## 1. O produto

**Batuta** — SaaS multi-tenant de difusão 1:1 no WhatsApp, distribuindo mensagens por
vários chips remetentes. O valor do produto está no **ritmo**: espalhar os envios de modo
que o comportamento não pareça disparo em massa, porque é isso que derruba chip.

Requisitos em `apps/batuta-system/Requisitos/`:
- `BATUTA_SPEC.md` — a especificação principal.
- `BATUTA_ADENDO_01_PRESENCA.md` — fase de "digitando" antes do envio. **Não implementado**
  (aguarda decisão, ver §6).
- `BATUTA_ADENDO_02_EXECUCAO.md` — correções de execução. **§1 implementado**; §2, §3 e §4
  pendentes.

### Stack
NestJS 10 + Fastify · MikroORM 6 (PostgreSQL) · BullMQ + Redis · MinIO (S3) ·
Evolution API (WhatsApp não oficial) · Next.js 14 App Router + MUI no frontend.

Arquitetura hexagonal estrita: `domain` → `application` (ports/use cases) → `infrastructure`.
Tokens de DI por Symbol; entidade de domínio ≠ entidade ORM, sempre com mapper.

### Isolamento entre tenants (o que não pode ser quebrado)
- Filtro global do MikroORM ligado por padrão, que **lança exceção** se não houver `accountId`.
- `TenantScopedJobRunner` para jobs (faz fork do EM). Cron sem request usa `runUnscoped()`.
- `ScopedRawQueryService` é o **único** caminho autorizado para SQL bruto, e recusa qualquer
  SQL que não cite `:accountId`.

---

## 2. Infraestrutura em produção

| Item | Valor |
|---|---|
| Plataforma | Dokploy em `dokploy.mdantas.com.br` |
| Domínio da app | `batuta.techbs.com.br` (backend em `/api`, frontend em `/`) |
| Banco | PostgreSQL self-hosted no Dokploy |
| Redis | serviço do Dokploy (host interno gerado, **não** o nome amigável) |
| MinIO | serviço no Dokploy; console em `minio.techbs.com.br` |
| Evolution | `evo2.techbs.com.br` |
| Git de deploy | GitLab `eliab1/batuta`, branch `main`, via Deploy Key read-only |

Notas que já custaram tempo:
- Base das imagens Docker: **`node:22-alpine`** (o `@supabase/*` exige ≥ 22).
- **Docker Context Path = `/`** (raiz do repo), senão o `COPY` do monorepo falha.
- O `.prettierrc` precisa ser copiado para a imagem do frontend, senão o ESLint do
  `next build` usa os defaults do prettier e falha em todo arquivo.
- Prettier fixado em **exatamente** `3.9.6` nos dois repos (drift de versão quebra o build).
- Registro DNS na Cloudflare tem de ficar **DNS only (nuvem cinza)**, senão o Let's Encrypt
  não emite certificado.

### Variáveis relevantes (valores só no Dokploy)
```
DATABASE_URL, REDIS_HOST/PORT/PASSWORD/USERNAME
MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
EVOLUTION_API_URL, EVOLUTION_API_KEY            # chave GLOBAL — só para criar instância
EVOLUTION_SYSTEM_INSTANCE, EVOLUTION_SYSTEM_APIKEY   # instância de sistema (reset de senha)
EVOLUTION_WEBHOOK_URL=https://batuta.techbs.com.br/api/webhooks/evolution
EVOLUTION_WEBHOOK_TOKEN                          # segredo do header do webhook
CORS_ORIGIN, FRONTEND_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
```
`EVOLUTION_API_KEY` (global) e `EVOLUTION_SYSTEM_APIKEY` (da instância) são **chaves
diferentes** — confundi-las é erro recorrente. Enviar mensagem usa a da instância;
criar/apagar instância usa a global.

---

## 3. O que foi entregue nesta conversa

Commits no repo de deploy, do mais antigo ao mais recente.

| Commit | O quê |
|---|---|
| `643b399` | Link de origem editável na tela do conteúdo |
| `69d887f` | Mídia clicável na página de aprovação e procedência visível |
| `1a314ff` | Clicar na imagem da aprovação leva ao post de origem |
| `8de3c20` | Rejeição deixa de ser beco sem saída (editar um REJECTED devolve para DRAFT) |
| `ecc9516` | `sourceUrl` declarado no response DTO e nunca mapeado — não chegava na página |
| `fe685bc` | Público vazio distingue "tag não existe" de "base vazia" |
| `27d809f` | **A campanha enviava só o texto — a mídia nunca ia junto** |
| `c96f40f` | Link de origem pode ir NA mensagem, e aí conta no hash |
| `d2be032` | **Tag com maiúscula não achava ninguém** (filtro comparava caixa) |
| `2848541` | Tags do público viram multiselect das que existem na base |
| `00511e3` | Excluir contato + webhook que ficava gravado **desabilitado** |
| `b593a33` | **Adendo 02 §1** — intervalo entre envios passa a valer em runtime |
| `52d8eab` | "Está PLANNED e não enviou nada" ganha resposta na tela |
| `425fe8d` | Diagnóstico de webhook + `/webhook/set` em dois formatos |

### 3.1 Envio de mídia (`27d809f`)
`ExecuteDispatchUseCase` só chamava `sendText`. O aprovador aprovava mensagem com imagem
e saía texto puro, com o despacho marcado como SENT.

Agora a mídia vai **com o texto como legenda, em UMA mensagem**. Uma só, e é estrutural:
o contador de cota é incrementado uma vez por despacho e o ritmo entre envios é o núcleo
anti-ban. Dois envios por contato dobrariam o volume real atrás de um contador que conta um.

- `Content.mediaFor(variantId)` — o mais específico ganha: variante com anexo próprio manda
  o dela, variante sem anexo herda o do conteúdo. **Nunca soma os dois.**
- `findAttachmentProblems` recusa **no planejamento** o que não cabe em uma mensagem:
  mais de um anexo, ou texto acima de **1024 caracteres** (limite de legenda do WhatsApp;
  o corpo pode ter 4000 quando vai sozinho).
- Documento vai por `sendDocument`, imagem/vídeo por `sendMedia`.
- Os bytes são lidos do MinIO **antes** de reservar a cota: se o storage cair, a linha volta
  para PENDING sem gastar cota e sem abrir o circuit breaker do canal.

### 3.2 Link de origem na mensagem (`c96f40f`)
`source_url` era só procedência (metadado para o aprovador). Agora há a flag
`contents.include_source_url`:
- **Ligada**, o link é acrescentado ao fim do texto em linha própria (para o WhatsApp
  renderizar como link) e **entra no `content_hash`**. Sem isso, alguém trocaria o destino
  depois da aprovação sem invalidar nada.
- **Desligada**, continua fora do hash — corrigir um link de procedência não pode custar
  uma aprovação.
- Ligar, desligar ou trocar o link com a flag ligada devolve o conteúdo para DRAFT.
- O texto é composto em `Content.sendableBodies`, o único lugar de onde todo caminho de
  envio já lê (planejamento, prévia, página de aprovação, checagem de legenda). Concatenar
  na hora do envio faria a mensagem divergir do que foi aprovado e nada perceberia.
- Migration `Migration20260807100000`.

### 3.3 Filtro de tag ignorando maiúsculas (`d2be032`)
O contato guarda a tag como foi escrita (`Brasilia`); todo filtro minúsculo o que o operador
digita. O `$contains` do jsonb é exato, então nunca casavam — e a campanha respondia
"nenhum contato enviável" com os contatos ali. Falha **silenciosa**, sem erro.

O filtro resolve a tag digitada para a gravada, comparando os dois lados em minúscula, e só
então filtra pelo valor gravado (mantendo o índice GIN). **Se nenhuma tag casar, devolve
vazio explicitamente** — um `$or` vazio o MikroORM descarta e o filtro viraria "a base
inteira", o pior desfecho possível para algo que decide quem recebe mensagem.

### 3.4 Excluir contato (`00511e3`)
`DELETE /contacts/:id`, só admin da conta. Recusa em duas situações, e as recusas **são** a
feature:
- **Já aparece em envio** — `dispatches` é a prova do que foi enviado, para quem e quando.
- **Pediu para sair** — apagar a linha é o jeito de tornar um opt-out reversível: a próxima
  importação traz o número de volta sem a marca.

Auditoria gravada **antes** do delete (depois não há de onde ler nome e tags), com telefone
mascarado.

### 3.5 Guard de intervalo em runtime — Adendo 02 §1 (`b593a33`)
O espaçamento de 45–120s existia **só** no `delay` do job BullMQ, calculado no planejamento.
Promessa que vale enquanto a fila nunca atrasa — e deploy/restart no Dokploy é rotina.
**Concorrência 1 não resolve: serializar não é espaçar.** A 1–2s por envio, 100 jobs
acumulados saem em três minutos.

- `ChannelRepositoryPort.reserveSendSlot` é **UM UPDATE condicional**, e esse é o mecanismo
  inteiro de concorrência: dois workers disputam a linha, o perdedor relê a versão nova sob
  READ COMMITTED e o WHERE deixa de casar.
- Recusado, devolve **o que falta** do intervalo.
- Roda **antes** do `claimDue`: reivindicar incrementa `attempts` e adiamento não pode gastar
  tentativa; e o canal é relido depois, então o agregado salvo carrega a reserva.
- No worker, `moveToDelayed` + `DelayedError` — único caminho do BullMQ que empurra o job sem
  gastar tentativa nem marcar falha. Com jitter curto de até 5s.
- `last_send_at` serve de reserva **e** de registro do último envio (uma coluna só). Um envio
  que falha segura o slot por um intervalo: lado seguro de errar.

> **Desvio consciente da letra do adendo**, que aguarda aval: o §1.2 diz que `last_send_at`
> é atualizado "no envio bem-sucedido". Usei uma coluna só, escrita na reserva.

### 3.6 Diagnóstico de webhook (`425fe8d`)
"A resposta do contato não chegou" tem cinco causas indistinguíveis de fora, todas com a
mesma aparência de "ninguém respondeu": sem webhook; webhook **desabilitado**; sem o
cabeçalho de autenticação (o backend responde 401 e a Evolution desiste); sem
`MESSAGES_UPSERT`; URL errada.

Botão **"Webhook"** na tela de canais → `POST /channels/:id/webhook-diagnosis` → consulta
`GET /webhook/find` na Evolution e nomeia **um** problema por vez, na ordem em que bloqueiam.
Ler **não** reconfigura (senão nunca se vê o defeito); o reparo é um segundo botão.

Junto: `POST /webhook/set` passa a tentar **dois formatos de corpo** — `{ webhook: {...} }`
e os campos no topo — porque a Evolution mudou isso no meio da série v2 e o formato errado é
respondido com 400 e nada mais.

---

## 4. Bugs corrigidos que valem lembrar como padrão

1. **Campo declarado no response DTO e nunca mapeado** (`sourceUrl`, `ecc9516`). O
   TypeScript não pega: `campo!: string` afirma que será atribuído. Existe teste que itera
   as chaves do DTO de origem justamente para isso —
   `test/unit/approval/approval-page-response.spec.ts`. **Repita esse padrão** em DTOs novos.
2. **Campo que vem da API e a tela descarta** (`alreadySentToday`, `52d8eab`) — mesma classe
   de bug, do outro lado.
3. **`ValidationPipe` com `forbidNonWhitelisted`**: `@Param()` sem chave valida o objeto
   inteiro de params contra o DTO. Um `@Param() dto: TokenDto` numa rota com dois params dá
   400 com mensagem enganosa.
4. **Rota literal declarada DEPOIS de `@Get(':id')`** cai no `ParseUUIDPipe` e dá 400. Já
   aconteceu com `/contacts/imports` e `/contacts/tags`.
5. **BullMQ recusa `:` em `jobId`** — é o separador das chaves dele no Redis. Três crons
   ficaram enfileirando nada em silêncio.
6. **Cron não tem request**, então o EM compartilhado é recusado pelo MikroORM. Usar
   `TenantScopedJobRunner.runUnscoped()`.
7. **Query builder do MikroORM prefixa o alias em toda expressão selecionada**: `count(*)`
   vira `c.count(*)` e o Postgres recusa. Agregados vão pelo `ScopedRawQueryService`.
8. **URL pré-assinada do MinIO é assinada contra o host do endpoint** — com host interno de
   container, o navegador não resolve. Mídia da aprovação é servida por rota do backend.

---

## 5. Decisões pendentes — precisam do Eliab

| # | Decisão | Estado |
|---|---|---|
| A | **Adendo 01 (presença "digitando")** — implementar? | **Bloqueado**, ver §6 |
| B | **Concorrência do worker** — 1 ou N? | **Bloqueia o Adendo 01** |
| C | Planejador que ignora despachos já agendados por outro plano | Reportado, não corrigido |
| D | `last_send_at` como coluna única (desvio do Adendo 02 §1.2) | Aguarda aval |
| E | Conteúdo com 2+ mídias é recusado no planejamento | Implementado assim; reversível |
| F | Excluir contato com opt-out exigiria lista de supressão | Não feito |
| G | Caixa de entrada em tempo real: polling ou WebSocket | Recomendado polling |
| H | Thresholds do throttle (§14 do spec, itens 1–3) | `// DECISÃO PENDENTE` no código |
| I | Adendo 02 §2 (mídia por URL), §3 (`binding_constraint`), §4 (teto horário em config) | Não iniciados |

---

## 6. O conflito entre os dois adendos (importante)

O **Adendo 02 §1.3** diz "mantenha concorrência 1 por enquanto".
O **Adendo 01 §12** exige o teste *"canais processam em paralelo: envios de canais distintos
agendados para o mesmo instante ocorrem simultaneamente, não em sequência"*.

Com concorrência global 1 e ~10s de presença por job, esse teste **falha por construção**:
3 chips no mesmo instante viram t, t+10s, t+20s. A conta é `N chips × 10s < intervalo mínimo
de 45s`, ou seja, **concorrência 1 funciona até ~4 chips** e depois começa a perder slots.

Duas saídas:
1. **Concorrência = N numa fila só**, com o guard garantindo a serialização dentro do canal.
   Recomendada: o guard já faz o trabalho que a alternativa compraria com muito mais máquina.
2. **Uma fila BullMQ por canal** (letra do Adendo 01 §2). Custa filas dinâmicas criadas ao
   conectar um chip; `@nestjs/bullmq` registra filas estaticamente, seria preciso instanciar
   `Worker` na mão.

> **Achado:** a Opção B do Adendo 02 §1.2 (`limiter` com `group` por canal) **não existe no
> BullMQ open source** — é recurso do BullMQ Pro, pago. O adendo oferece uma escolha que na
> prática não está disponível.

E o §1.4 do Adendo 02 avisa: aplicar o Adendo 01 **sem** o guard degrada a situação. O guard
já está entregue, então essa ordem está satisfeita.

---

## 7. Como as coisas funcionam (para não redescobrir)

### Fluxo de uma distribuição
```
Ver prévia   → nada é persistido (dry run)
Salvar plano → grava as linhas de dispatch, status DRAFT. NADA é enfileirado.
Confirmar e enviar → status PLANNED e SÓ AQUI os jobs entram na fila
primeiro envio → RUNNING
```
**"Salvar plano" não envia.** Se a distribuição está em DRAFT, falta confirmar — foi a causa
de um "por que não enviou?" nesta conversa.

### Ritmo e tetos, na ordem em que amarram
1. horário permitido (08:00–21:00) · 2. janela · 3. cota do canal menos 20% de reserva do
inbox · 4. máximo 30/hora por canal · 5. **teto diário da conta**, que prevalece sobre a soma
dos canais.

Chip novo nasce no piso de **20/dia**; menos a reserva, **16 envios de campanha por dia**.
O que não cabe hoje **não é descartado** — é agendado para o próximo dia às 08:00. Por isso
uma campanha pode ficar PLANNED sem enviar nada e estar perfeitamente correta.

### Paralelismo
Cada canal tem cursor próprio no planejador (`nextAt` e balde de hora), e a distribuição é
round-robin entre canais. O intervalo de 45–120s é **por chip**. Contato é fixado num chip
(`current_channel_id`) e o envio **nunca** cai para outro se o dele estiver indisponível —
vira BLOCKED com `SENDER_UNAVAILABLE`.

### Caixa de entrada
Webhook síncrono: a Evolution faz POST e o handler grava conversa e mensagem na mesma
requisição. Latência real de fração de segundo. **A tela não se atualiza sozinha** — só ao
clicar em "Atualizar", trocar o filtro, ou reabrir a página.

### Reset de senha
Código de 6 dígitos pelo WhatsApp via instância de sistema da Evolution. Regras: `randomInt`
do `node:crypto`, só o hash bcrypt guardado, TTL de 15 min, uso único, máximo 5 tentativas,
um código vivo por usuário, canal verificado **antes** de olhar o usuário (senão vira oráculo
de enumeração de contas), e o código **jamais** em log.

---

## 8. Comandos

```bash
# Sempre DENTRO do diretório do app — os scripts da raiz do monorepo já estavam quebrados
# antes deste trabalho (dívida antiga) e falham para todos os apps.
cd apps/batuta-system/backend
npx tsc --noEmit -p tsconfig.json
npx eslint src test --ext .ts --fix --max-warnings=0
npx jest --silent                     # 769 testes na data deste documento

cd apps/batuta-system/frontend
npx tsc --noEmit
npm run lint                          # next lint --max-warnings=0
npx jest --silent                     # 35 testes

# Migration local
cd apps/batuta-system/backend && npm run migration:up

# Produção (terminal do container do backend no Dokploy)
cd /repo/apps/batuta-system/backend && npm run migrate:prod
npm run admin:create                  # criar admin de plataforma
```

**Sincronizar para o repo de deploy antes de commitar** — copiar cada arquivo alterado de
`C:\HD\Eliab\KAZATEM\apps\batuta-system\<caminho>` para
`C:\HD\Eliab\batuta\apps\batuta-system\<caminho>`, e commitar/`push` em `C:\HD\Eliab\batuta`.

---

## 9. Próximo passo imediato

1. Redeploy do **backend e do frontend** (não há migration pendente depois de `425fe8d`).
2. Na tela de Canais, botão **"Webhook"** no chip. Reportar os cinco itens do diagnóstico —
   é isso que fecha a investigação da resposta que não chega ao inbox.
3. Decidir §5-A e §5-B (Adendo 01 e concorrência) para destravar a próxima fase.

---

## 10. Regras de trabalho combinadas

- **Conversa em português (pt-BR)**; código e comentários em inglês (comentários novos do
  Batuta têm saído em português também, seguindo o que já existia no repositório).
- **Entrega faseada**: uma fase por vez, com relatório e **aprovação explícita** antes da
  próxima. Vale especialmente para os adendos.
- **Segurança por desenho não é negociável**: guard em todo endpoint protegido, validação
  `class-validator` em todo campo de DTO, nunca expor entidade de domínio via HTTP, nunca
  logar telefone, token, senha ou corpo de mensagem.
- Valor numérico que afeta comportamento e não está no spec **não vira default silencioso**:
  marcar `// DECISÃO PENDENTE` e reportar na entrega (Adendo 02 §4).
