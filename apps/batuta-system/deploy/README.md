# Deploy do Batuta no mdantas (Dokploy)

Segue o playbook do `CLAUDE.md` → *Deploy no Servidor mdantas*. Este arquivo tem só o que é
**específico do Batuta**: os valores exatos, a lista de variáveis e a ordem das operações.

## Serviços (4 por ambiente)

| Serviço | Tipo no Dokploy | Observação |
|---|---|---|
| `batuta-postgres` | Database → PostgreSQL | Dimensione `max_connections` somando API + workers (§11) |
| `batuta-redis` | Database → Redis | BullMQ. Guarde o **Internal Host** gerado — não o nome amigável |
| `batuta-backend` | Application | Dockerfile `apps/batuta-system/backend/Dockerfile` |
| `batuta-frontend` | Application | Dockerfile `apps/batuta-system/frontend/Dockerfile` |

MinIO é opcional no primeiro deploy: sem ele a importação de contatos e as mídias param, o resto
funciona. Se for usar, suba como Application (`minio/minio`) ou aponte para um MinIO existente.

## Configuração de build — os dois erros que já custaram tempo

Para **os dois** Applications:

- **Build Type**: `Dockerfile`
- **Docker Context Path**: `/` ← **a raiz do monorepo**. Sem isso os `COPY` falham com
  `"/xxx": not found`, porque os Dockerfiles copiam `packages/` e `package-lock.json` da raiz.
- **Provider**: Git + **Deploy Key** (a chave pública da SSH Key do Dokploy cadastrada em
  GitLab → Settings → Repository → Deploy keys). Não use a integração OAuth do GitLab.

Domínios:

| Application | Host | Path | Strip Path | Container Port |
|---|---|---|---|---|
| backend | `batuta.<dominio>` | `/api` | **OFF** | `3010` |
| frontend | `batuta.<dominio>` | `/` | — | `3003` |

`Strip Path OFF` no backend porque o Nest usa `setGlobalPrefix('api')` — com strip, cada rota
chegaria sem o prefixo e daria 404 em tudo.

**Não** defina `NEXT_PUBLIC_API_URL` no frontend. A base padrão é `/api` relativo, e com os dois no
mesmo domínio isso é o que faz funcionar. `NEXT_PUBLIC_*` é embutido no build do Next, então se um dia
a API ganhar domínio próprio, passe como **Build Arg** — variável de runtime não resolve.

DNS (Cloudflare): registro **A** → `72.61.43.90`, **Proxy status = DNS only (nuvem CINZA)**. Com
"Proxied" o Let's Encrypt do Dokploy não emite o certificado.

## Variáveis de ambiente (aba Environment do backend)

Valores reais só aqui — nunca no repositório.

```env
NODE_ENV=production
PORT=3010
HOST=0.0.0.0

DATABASE_URL=postgresql://<user>:<senha>@<internal-host>:5432/batuta

REDIS_HOST=<INTERNAL_HOST_DO_REDIS_NO_DOKPLOY>
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=<senha do Redis>

# Dois segredos DIFERENTES, aleatórios, 32+ bytes. Trocar invalida as sessões em uso.
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<outro openssl rand -base64 48>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# WhatsApp (Evolution). A chave GLOBAL só é necessária para criar instâncias.
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_API_KEY=<AUTHENTICATION_API_KEY do servidor Evolution>
EVOLUTION_WEBHOOK_TOKEN=<segredo próprio, usado no header x-batuta-webhook-token>
EVOLUTION_WEBHOOK_URL=https://batuta.<dominio>/api/webhooks/evolution
# Instância dedicada da PLATAFORMA: avisos de aprovação E o código de recuperação de senha.
# NUNCA um chip de tenant.
EVOLUTION_SYSTEM_INSTANCE=batuta-sistema
# Apikey DA INSTÂNCIA acima (não a global). Vazia = usa a global e o boot avisa.
EVOLUTION_SYSTEM_APIKEY=<apikey da instância batuta-sistema>

# Storage
MINIO_ENDPOINT=<host>
MINIO_PORT=9000
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_USE_SSL=true
MINIO_BUCKET_PREFIX=batuta-

# E-mail (Mailcow) — usado pelos links de aprovação (o reset de senha vai por WhatsApp)
SMTP_HOST=mail.mdantas.com.br
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<usuario>
SMTP_PASSWORD=<senha>
SMTP_FROM=no-reply@<dominio>

# Web
CORS_ORIGIN=https://batuta.<dominio>
FRONTEND_URL=https://batuta.<dominio>
```

`FRONTEND_URL` é o que monta o link de aprovação. Se ficar com `localhost`, o link chega no WhatsApp
como texto puro e o aprovador não consegue clicar.

`CORS_ORIGIN` com o domínio real, nunca `*`: a API usa credenciais.

As variáveis de decisão pendente (throttle, jitter, quiet hours, TTL da trava) têm default no código e
só precisam entrar aqui quando você quiser mudá-las. Todas estão em `.env.example`.

## Ordem do primeiro deploy

1. **Postgres e Redis** primeiro. Copie o Internal Host de cada um.
2. **Backend**: crie, preencha Environment, `Save`, `Deploy`.
3. **Migrations** — o passo que não pode ser esquecido:
   ```bash
   # No terminal do container do backend (Dokploy → serviço → Terminal)
   npm run migrate:prod
   ```
   Roda de código **compilado** (`dist/`), sem ts-node e sem dependências de dev. Falha com exit
   diferente de zero se não conseguir aplicar — o que é o comportamento certo: melhor o deploy parar
   do que a API subir contra um schema que não corresponde ao código.
4. **Admin da plataforma** — o único cadastro que não tem tela, porque é quem cria as contas: não há
   ninguém logado para criar o primeiro. No terminal do container:
   ```bash
   ADMIN_NAME="Seu Nome" ADMIN_EMAIL="voce@dominio.com" ADMIN_PASSWORD="<senha forte>" \
     npm run admin:create
   ```
   Roda de código compilado, aplica a mesma política de senha da API (mínimo 10 caracteres com letra
   e número) e **não sobrescreve** um admin existente. Para trocar a senha de um que já existe,
   repita com `ADMIN_RESET_PASSWORD=true`.

   Localmente, onde a configuração está num arquivo e não no ambiente, use
   `node -r dotenv/config dist/infrastructure/persistence/mikro-orm/create-platform-admin`.

   Depois, entre em `https://batuta.<dominio>/platform` e use **Nova conta** para criar o gabinete e
   o primeiro administrador dele — que aí entra pelo login normal, em `/login`.
5. **Frontend**: crie, `Deploy`. Nada de Environment.
6. **DNS**: A → `72.61.43.90` cinza; `Validate DNS` no Dokploy até ficar verde; HTTPS ON.
7. **Webhook do Evolution**: aponte para `https://batuta.<dominio>/api/webhooks/evolution` com o
   header `x-batuta-webhook-token` igual a `EVOLUTION_WEBHOOK_TOKEN`. Sem isso, entrega, desconexão
   de chip e inbound não chegam — e sem os acks de entrega o throttle lê 0% de entrega e derruba a
   cota de todos os canais para o piso.

## A cada deploy seguinte

1. `Deploy` (ou push na branch, se o auto-deploy estiver ligado).
2. `npm run migrate:prod` no terminal do container, **sempre** — mesmo achando que não houve
   migration nova. O comando é idempotente e responde "Nenhuma migration pendente".
3. Confira `GET https://batuta.<dominio>/api/health`.

Mudou Environment? `Save` **e** `Redeploy` — variável nova só entra em deploy novo.

## Sintomas conhecidos

| Sintoma | Causa | Correção |
|---|---|---|
| `COPY ... not found` no build | Docker Context Path na pasta do Dockerfile | Context Path = `/` |
| 404 em toda rota da API | Strip Path ligado no domínio do backend | Strip Path OFF |
| Frontend chama `localhost:3010` | `NEXT_PUBLIC_API_URL` embutido em build antigo | Rebuild **com Clean Cache** e `Ctrl+Shift+R` |
| `getaddrinfo ENOTFOUND batuta-redis` | `REDIS_HOST` com nome amigável | Use o Internal Host gerado |
| Let's Encrypt não emite | Cloudflare "Proxied" (laranja) | DNS only (cinza) |
| Todos os canais caem para o piso da cota | Webhook de ack não configurado | Configure o webhook do Evolution |
| Link de aprovação não clicável no WhatsApp | `FRONTEND_URL` com localhost | Domínio real com https |
| Recuperação de senha responde 400 para todo e-mail | `EVOLUTION_SYSTEM_INSTANCE` ou a apikey ausente | Preencha as duas; o boot registra o que falta |
| Recuperação de senha responde 204 e nada chega | Usuário sem `phone`, limite de 3 envios/hora, ou a instância de sistema desconectada | Veja o log do backend — a resposta é a mesma nos três casos de propósito (não entrega quais contas existem) |
| Usuário antigo não consegue recuperar a senha | Linha criada antes da coluna `users.phone` | `PATCH /users/:id/phone` (ACCOUNT_ADMIN) |
| API sobe mas erra em toda query | Migrations não aplicadas | `npm run migrate:prod` |

## Infra local (desenvolvimento)

```bash
docker compose -f apps/batuta-system/docker-compose.yml up -d
npm run migration:up -w apps/batuta-system/backend
npm run seed:dev -w apps/batuta-system/backend
npm run dev -w apps/batuta-system/backend    # :3010
npm run dev -w apps/batuta-system/frontend   # :3003
```

Sobe Postgres (`:55432`), Redis (`:56379`), MinIO (`:59000`, console `:59001`) e Mailpit
(`:51025` SMTP, UI em `http://localhost:58025`). O Mailpit é onde se lê o link de aprovação em
desenvolvimento — sem ele, o magic link não é testável de ponta a ponta.
