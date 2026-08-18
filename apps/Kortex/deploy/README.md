# Deploy do Kortex — mdantas / Dokploy

Domínio: **https://kortex.ind.br** · Banco: **PostgreSQL 17** em container do Dokploy ·
Sem Redis, sem storage.

Um domínio, dois serviços: o Traefik roteia `/api` para o backend e `/` para o frontend. É por
isso que o frontend não precisa de nenhuma variável de ambiente — `services/api.ts` usa `/api`
relativo e o backend responde em `setGlobalPrefix('api')`.

---

## 1. Repositório: recorte espelhado (§9 da spec)

O Dokploy clona `git@gitlab.com:eliab1/kortex.git`, que contém na raiz:

```
package.json          workspaces: packages/*, apps/Kortex/backend, apps/Kortex/frontend
package-lock.json     versionado — `npm ci` exige
tsconfig.base.json
.dockerignore
packages/             domain-primitives, shared-kernel
apps/Kortex/          backend, frontend, deploy
```

**A fonte da verdade continua sendo o monorepo.** O espelho é gerado, nunca editado:

```bash
./apps/Kortex/deploy/publish-mirror.sh --dry-run   # confere o recorte
./apps/Kortex/deploy/publish-mirror.sh             # publica
```

O script recusa publicar com árvore suja — espelho de trabalho não commitado não corresponde a
commit nenhum, e quando alguém for comparar os dois repositórios não vai achar o código que está
no ar.

**Não é `git subtree`.** O `subtree split` extrai _um_ prefixo, e o recorte precisa de três coisas
sem prefixo comum (`packages/`, `apps/Kortex/`, `package.json`). Costurar três splits geraria um
histórico que não existe em lugar nenhum. O espelho é de **conteúdo**: cada publicação é um commit
único apontando para o SHA de origem, e o push é `--force` de propósito.

---

## 2. Serviços no Dokploy

Project `kortex` (ou o que você escolher), dois serviços:

|                         | Backend                            | Frontend                          |
| ----------------------- | ---------------------------------- | --------------------------------- |
| Tipo                    | Application                        | Application                       |
| Provider                | Git + Deploy Key                   | Git + Deploy Key                  |
| URL                     | `git@gitlab.com:eliab1/kortex.git` | idem                              |
| Branch                  | `main`                             | `main`                            |
| Build Type              | Dockerfile                         | Dockerfile                        |
| Docker File             | `apps/Kortex/backend/Dockerfile`   | `apps/Kortex/frontend/Dockerfile` |
| **Docker Context Path** | **`/`**                            | **`/`**                           |
| Domain Host             | `kortex.ind.br`                    | `kortex.ind.br`                   |
| **Path**                | **`/api`**                         | **`/`**                           |
| Strip Path              | **OFF**                            | —                                 |
| Container Port          | **3030**                           | **3031**                          |
| HTTPS                   | ON (Let's Encrypt)                 | ON                                |

**Docker Context Path = `/` não é detalhe.** Os dois Dockerfiles copiam `packages/` da raiz; com o
contexto na pasta do app, o build morre com `"/packages": not found`.

**Strip Path OFF no backend.** A aplicação já serve sob `/api`; com strip, o Traefik entregaria
`/reservations` e todas as rotas dariam 404.

### Deploy Key

Cadastrar a **chave pública** da SSH Key do Dokploy em GitLab → projeto `kortex` → Settings →
Repository → Deploy keys (read-only). Não usar a integração OAuth do GitLab — ela dá
"Failed to refresh token".

### PostgreSQL

`Create Service → Database → PostgreSQL` (17). Depois, na página do serviço, copiar o
**Internal Host** — é o nome gerado (algo como `kortex-postgres-a1b2c3`), **não** o nome amigável.
É com ele que se monta a `DATABASE_URL`.

### DNS (Cloudflare)

`kortex.ind.br` → **A** → **72.61.43.90** → **Proxy status: DNS only (nuvem CINZA)**.

Cinza é obrigatório: com "Proxied" o Let's Encrypt do Dokploy não emite o certificado.

---

## 3. Migrations: script separado, não no start

**Decisão: as migrations NÃO rodam no start do container.** Elas são aplicadas por um comando
explícito, depois do deploy:

```bash
# No terminal do serviço backend, no Dokploy:
node dist/infrastructure/persistence/mikro-orm/run-migrations.js
# equivalente: npm run migration:deploy
```

Três motivos, e nenhum é preferência:

1. **Redeploy do Dokploy tem dois containers vivos ao mesmo tempo.** O novo sobe antes de o antigo
   morrer — é assim que se consegue deploy sem janela. Com migration no start, os dois disparam
   `migration:up` contra o mesmo banco no mesmo segundo. O MikroORM tem lock, então o mais provável
   não é corrupção: é um container travado esperando o outro e um deploy que "não termina".

2. **Migration que falha vira crash-loop.** Ligada ao boot, o processo morre, o Docker reinicia, o
   healthcheck nunca fica verde e o Dokploy reporta _aplicação fora do ar_. O operador vai
   investigar o app quando o problema é uma coluna. Separada, a falha aparece na hora, com a
   mensagem do Postgres, e a aplicação anterior continua servindo.

3. **Migration é decisão.** Uma que apaga coluna não pode acontecer porque alguém clicou em
   "Restart". Rodar à mão é o passo em que se olha o que vai ser aplicado — e o
   `run-migrations.js` lista as pendentes antes de aplicar, justamente para isso.

O executor é compilado (`src/infrastructure/persistence/mikro-orm/run-migrations.ts` → `dist/`)
para a imagem de runtime não precisar de `ts-node`, `typescript` nem do CLI do MikroORM: o CLI lê
`mikro-orm.config.ts`, um arquivo TypeScript da raiz do backend que o `nest build` não compila.

---

## 4. Primeira conta e o primeiro dono

Depois das migrations, uma vez só, no terminal do backend:

```bash
node dist/infrastructure/bootstrap/create-account.js \
  --name "Corte Ceres · APL" \
  --city "Ceres" \
  --timezone "America/Sao_Paulo" \
  --owner-name "Gleidson Dantas" \
  --owner-email "gleidson@corteceres.com.br" \
  --owner-phone "62996010090"
```

Não há rota pública de cadastro de conta, por decisão: o Kortex é multiconta, mas cada conta é uma
operação real.

**Sem `--owner-password`, a senha é gerada** com `randomBytes` e impressa **uma vez** no terminal.
O usuário nasce com `must_change_password = true` — a senha inicial passou por um terceiro e por um
terminal, e não pode continuar valendo depois do primeiro acesso.

Depois: entrar, trocar a senha, configurar as janelas de funcionamento e cadastrar as máquinas.

---

## 5. Ordem do primeiro deploy

1. Criar o PostgreSQL, anotar Internal Host e senha.
2. DNS no Cloudflare (A → 72.61.43.90, cinza) e **Validate DNS** no Dokploy.
3. Publicar o espelho: `./apps/Kortex/deploy/publish-mirror.sh`.
4. Criar os dois Applications com os valores da tabela do §2.
5. Preencher **Environment** do backend (tabela em `.env.production.example`) → **Save**.
6. **Deploy** do backend. Acompanhar Deployments (build) e Logs (runtime).
7. `npm run migration:deploy` no terminal do backend.
8. `create-account.js` — anotar a senha temporária.
9. **Deploy** do frontend.
10. Abrir `https://kortex.ind.br/login` e entrar.

Nos deploys seguintes: publicar o espelho → Deploy → rodar migrations **se** houver pendente.

---

## 6. Erros que já custaram tempo (do playbook do CLAUDE.md)

| Sintoma no log                          | Causa                                   | Correção                          |
| --------------------------------------- | --------------------------------------- | --------------------------------- |
| `COPY ... "/packages": not found`       | Context Path na pasta do app            | Docker Context Path = `/`         |
| `EBADENGINE ... required node >=22`     | Imagem node 20                          | Base `node:22-alpine` (já está)   |
| `queryA ENOTFOUND kortex.ind.br`        | Registro A ausente                      | A → 72.61.43.90, cinza, revalidar |
| Let's Encrypt não emite                 | Cloudflare Proxied (laranja)            | DNS only (cinza)                  |
| `getaddrinfo ENOTFOUND kortex-postgres` | Nome amigável na `DATABASE_URL`         | Usar o **Internal Host**          |
| `password authentication failed`        | Senha errada ou placeholder             | Senha real; aguardar o cooldown   |
| Todas as rotas dão 404                  | Strip Path ligado no `/api`             | Strip Path OFF                    |
| Frontend chama `localhost:3001`         | `NEXT_PUBLIC_API_URL` embutida no build | Não definir: `/api` relativo      |
| Env novo não fez efeito                 | Env só entra em deploy novo             | Save + **Redeploy**               |
