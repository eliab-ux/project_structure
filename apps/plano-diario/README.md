# Plano Diário

Envia automaticamente, todos os dias no horário escolhido, a mensagem com **a data e o link do
vídeo do dia** do plano de leitura bíblica em um grupo de WhatsApp.

Fonte de verdade dos requisitos: [`Requisitos/PLANO_DIARIO_SPEC.md`](Requisitos/PLANO_DIARIO_SPEC.md).
Regras de arquitetura e segurança: `CLAUDE.md` na raiz do monorepo (prevalece em caso de conflito).

## Estrutura

```
apps/plano-diario/
├── backend/     # NestJS 10 + Fastify + MikroORM (PostgreSQL) — porta 3011
├── frontend/    # Next.js 14 (App Router) + MUI — porta 3013
└── Requisitos/  # especificação
```

## Formato exato da mensagem enviada

```
28 de JULHO
https://youtu.be/aSi0uip5XHg
```

Duas linhas, sem saudação, sem título do vídeo, sem `?si=` na URL.

O texto vai como **legenda da miniatura do vídeo**, não como mensagem de texto simples. Motivo: a
prévia do link no WhatsApp é montada por quem envia, e quem envia aqui é o Baileys dentro do
container da Evolution — que precisa buscar a página do YouTube a partir do IP do servidor e, quando
não consegue, manda texto puro sem imagem nenhuma. Então este backend baixa a miniatura do CDN
(`i.ytimg.com`, sem quota nem chave) e envia imagem + legenda, o que faz o vídeo aparecer sempre.

Se a miniatura não vier, a leitura é enviada como texto — o dia nunca deixa de ser enviado por
causa de uma imagem. E uma falha no envio da imagem **não** tenta o texto em seguida: o primeiro
POST pode ter sido entregue, e o grupo receberia a leitura duas vezes.

## Quando o envio acontece

Duas opções em Configuração → **Quando enviar**:

| Opção | `day_offset` | Às 10:00 de 29/07 o grupo recebe |
|---|---|---|
| No mesmo dia da leitura | `0` | a leitura de **29/07**, com "29 de JULHO" na mensagem |
| Um dia antes (na véspera) | `1` | a leitura de **30/07**, com "30 de JULHO" na mensagem |

A data que vai na mensagem é a **data da leitura**, não a data do envio — o cabeçalho nunca
contradiz o conteúdo. Já a `reference_date` do log continua sendo o dia do envio, porque é a chave
de idempotência do "um envio por dia": trocá-la pela data da leitura permitiria dois envios no
mesmo dia.

O schema aceita `day_offset` de −30 a 30; a tela oferece apenas 0 e 1, que são os casos com
significado prático.

## Conta e recuperação de senha

O cadastro exige **WhatsApp do dono da conta** — que não é o grupo que recebe a leitura, e sim o
número pessoal por onde o sistema fala com ele. É a única via de recuperação de senha, então
sem número a conta não tem como voltar se a senha for esquecida.

Contas criadas antes desse campo existir ficam com `phone` nulo (a coluna é anulável de
propósito, ver a migration). Elas preenchem o número no card **WhatsApp de contato**, em
Configuração, ou por `npm run create:admin -- --email=… --phone="(11) 91234-5678"`.

O fluxo de "esqueci minha senha":

1. `POST /api/auth/forgot-password` com o e-mail. Um código de **6 dígitos** é enviado pelo
   WhatsApp de suporte (instância própria na Evolution — `EVOLUTION_SUPPORT_INSTANCE`).
2. `POST /api/auth/reset-password` com e-mail, código e senha nova.

Decisões de segurança que o código sustenta:

- **A resposta do passo 1 é sempre a mesma**, exista a conta ou não — inclusive quando a conta
  está desativada, sem WhatsApp, ou estourou o limite de 3 pedidos por hora. Um 404 aqui viraria
  um verificador de e-mails cadastrados.
- **O código nunca é guardado em claro** — só o hash bcrypt. Nem um dump do banco nem um log
  revelam o valor; quem sabe é o dono do WhatsApp que o recebeu.
- **Vale 15 minutos, uma vez só, e aceita 5 palpites.** Cada erro é contado antes da recusa, o que
  transforma 1.000.000 de combinações em 5 chances.
- **Todas as recusas do passo 2 têm a mesma mensagem.** Distinguir "código errado" de "código
  inexistente" contaria se um código já havia sido pedido.
- Um pedido novo invalida o anterior: dois códigos vivos dobrariam a superfície de adivinhação.
- Limitação assumida: trocar a senha **não** derruba sessões abertas em outros aparelhos, porque
  os refresh tokens são JWT sem lista de revogação.

O canal fica atrás do port `SupportMessengerPort`, separado do `WhatsappGatewayPort` de propósito:
aquele é a conexão **do usuário** (que ele pareia e pode desconectar), este é a conta de suporte da
operação. Se o WhatsApp do usuário estiver fora do ar, a recuperação continua funcionando.

## Como rodar (desenvolvimento)

```bash
# na raiz do monorepo
npm install

# backend (porta 3011)
cd apps/plano-diario/backend
cp .env.example .env      # ajustar DATABASE_URL e secrets
npm run dev
# → GET http://localhost:3011/api/health

# frontend (porta 3013)
cd apps/plano-diario/frontend
cp .env.example .env.local
npm run dev
```

> Em desenvolvimento, se o `DATABASE_URL` ainda estiver com placeholder (`YOUR_PASSWORD` /
> `PROJECT_REF`), o MikroORM conecta de forma lazy e o app sobe sem banco real — útil para
> validar o bootstrap antes de provisionar o Postgres.

## Banco de dados

O backend **aplica as migrations pendentes no start** — não há passo manual, nem em produção.
Desligável com `MIGRATIONS_ON_BOOT=false`. Se a migration falhar, o processo não sobe (de
propósito: um backend sem schema responderia 500 em tudo).

Caminho manual equivalente, se preferir: [`deploy/sql/001_schema.sql`](deploy/sql/001_schema.sql)
— idempotente, e registra as migrations como aplicadas para o `migration:up` não recriar nada.

### Criar o primeiro admin

O cadastro público cria todo usuário como `user`, mas a sync manual do catálogo
(`POST /api/admin/catalog/sync`) exige `AdminGuard`. Para criar ou promover um admin:

```bash
# desenvolvimento
npm run create:admin -- --email=voce@exemplo.com --name="Seu Nome" --password=SenhaForte123
```

Se o e-mail já existir, o script só promove a conta a admin (e troca a senha, se `--password`
for passado) — nunca cria duplicado.

### Scripts em produção (terminal do container no Dokploy)

O terminal abre em `/`, e o **`cd` é obrigatório**: a config do MikroORM localiza as entidades por
caminho relativo (`./dist/**/*.entity.js`), então de `/` nenhuma entidade é encontrada — mesmo
usando o caminho absoluto do script.

```bash
cd /repo/apps/plano-diario/backend

# criar/promover admin
node dist/scripts/create-admin.js --email=voce@exemplo.com --name="Seu Nome" --password=SenhaForte123

# popular o catálogo (obrigatório num ambiente novo: sem ele o envio não resolve vídeo nenhum)
node dist/scripts/sync-catalog.js
```

## Bounded contexts (backend)

| Context | Responsabilidade |
|---|---|
| `auth` | Registro, login, refresh (JWT próprio) |
| `user` | Perfil do usuário |
| `whatsapp` | Instância Evolution, QR, estado de conexão, cache de grupos |
| `catalog` | Vídeos do YouTube; qual vídeo corresponde ao dia N |
| `schedule` | Grupo destino, horário, timezone; cálculo do número do dia |
| `dispatch` | Monta a mensagem, envia, registra histórico, garante 1 envio/dia |

## Status das fases (seção 9 da spec)

- [x] **Fase 0 — Bootstrap**: estrutura, config validada, Fastify + `ValidationPipe` global +
      `GlobalExceptionFilter`, CORS por `CORS_ORIGIN`, `/api/health` público, MikroORM plugado.
- [x] **Fase 1 — Auth + User**: contexts `user`/`auth`, VOs (`Email`, `UserId`, `UserRole`),
      use cases `RegisterUser`/`Login`/`RefreshToken`/`GetMe`, `JwtAuthGuard`/`AdminGuard`,
      migration `users` aplicada, 37 testes unitários.
- [x] **Fase 2 — Catálogo YouTube**: context `catalog`, `VideoSourcePort` + adapter YouTube Data
      API v3 (sync pela playlist de uploads), sequência de leituras como chave do dia, formatação
      pt-BR pura, migration `daily_videos`, endpoints `/catalog/today`, `/catalog/day/:n`,
      `/catalog/days` e `POST /admin/catalog/sync`. **363 leituras importadas** do canal real.
- [x] **Fase 3 — Conexão WhatsApp**: context `whatsapp`, `WhatsappGatewayPort` + adapter Evolution
      **v2.3.7**, instância própria por usuário (`pd_{userId}`), QR, polling de status,
      criptografia AES-256-GCM do token, logout e delete. Migration `whatsapp_instances`.
      *(Falta o aceite: QR escaneado num celular real.)*
- [x] **Fase 4 — Grupos**: `SyncGroups`/`ListGroups` com cache (`GET /api/whatsapp/groups`,
      `?refresh=true`), migration `whatsapp_groups` com `unique(user_id, group_jid)`.
      *(Falta o aceite: listar os grupos de um WhatsApp realmente conectado.)*
- [ ] Fase 5 — Agendamento
- [ ] Fase 6 — Dispatch + Scheduler (BullMQ)
- [ ] Fase 7 — Frontend
- [~] **Fase 8 — Deploy**: no ar em **https://dayplan.equipamentospsi.com** (Dokploy project
      `psi`). Backend em `/api` (porta 3011) e frontend em `/` (porta 3013), HTTPS por Let's
      Encrypt, migrations aplicadas no boot. Falta apenas o serviço Redis (necessário na Fase 6).

## Regra crítica que nunca muda

O vídeo do dia **nunca** é montado a partir de cálculo de data. O sistema resolve o
`day_number` (data local + `plan_start_date` + `day_offset`) e **busca no catálogo**. Se não
encontrar, **não envia nada** e registra `failed` — nunca um vídeo aproximado ou fallback.

## Catálogo do canal — o que o diagnóstico real mostrou (jul/2026)

Canal `UCZ_kBuubJo-mp3uRBRnW5Wg`, playlist de uploads `UUZ_kBuubJo-mp3uRBRnW5Wg`.
526 vídeos no canal, **363 leituras** do plano.

A numeração nos títulos **não é confiável como chave de dia**:

- os dias **96, 97 e 275 nunca existiram** (o autor pulou os números);
- **dois vídeos diferentes são "Dia 218"** (Isaías 64-66 e Jeremias 1-3, publicados em
  06 e 07/08/2020 — dias consecutivos). A partir daí todo título ficou 1 atrás do dia real;
- há vídeos "material complementar" que repetem o número do dia e devem ser ignorados;
- **ordenar por data de publicação não dá a sequência**: no início os vídeos subiram em lotes
  (9 de uma vez em 07/04/2020). A sequência vem do número do título, com o 218 desempatado
  pela data.

Por isso `daily_videos` guarda **duas chaves**: a posição na sequência (1…363, usada para
resolver o dia) e o número lido do título (auditoria — detecta erro novo de numeração).

### `PLAN_START_DATE = 2026-01-03`

Conferido contra o histórico real do grupo. Quatro âncoras batem simultaneamente:

| Data | Leitura |
|---|---|
| 28/07/2026 | Dia 209 - Isaías 29-31 |
| 06/08/2026 | Dia 218 - Isaías 64-66 *(como em 2025)* |
| 07/08/2026 | Dia 218 - Jeremias 1-3 *(como em 2025)* |
| 31/12/2026 | Dia 365 - Apocalipse 20-22 *(363ª e última leitura)* |

> A spec §5.1 afirma que 28/07/2026 seria o "dia 208". **Isso está errado** — era um cálculo, não
> o histórico. O sintoma de adotá-lo é o plano terminar em 01/01/2027 em vez de 31/12/2026.
