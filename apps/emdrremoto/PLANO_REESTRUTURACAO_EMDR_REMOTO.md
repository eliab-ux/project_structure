# Plano de Reestruturação — EMDR Remoto

> **Objetivo:** migrar o sistema atual (`serenata-js` + `front`) para os padrões do
> `CLAUDE.md` do GitSpread — NestJS + Fastify + MikroORM (**MySQL**) no
> backend, Next.js 14 + MUI no frontend, arquitetura hexagonal e Security by Design —
> **preservando 100% dos requisitos funcionais**, incluindo o tempo real (Socket.IO).
>
> **App-alvo no monorepo:** `apps/emdr-remoto-system/` (`backend/` + `frontend/`).
> **Deploy:** project `emdrremoto` no Dokploy (`emdrremoto.com.br`).

---

## 0. Como usar este documento com o Claude Code (VS Code)

Este arquivo é uma **spec de execução**. Trabalhe **fase a fase** (passo a passo). Para
cada fase, o padrão de prompt no Claude Code é:

```
Leia o CLAUDE.md (e CLAUDE_PYTHON.md se aplicável) e este PLANO.
Execute SOMENTE a "Fase N". Ao final, rode `npm run typecheck` + `npm run lint`
e me mostre o Definition of Done da fase antes de seguir.
```

Regras invioláveis (herdadas do CLAUDE.md, valem em toda fase):
- Domínio puro (sem framework). Dependências apontam para dentro.
- Todo request validado (`class-validator`); nenhuma domain entity exposta via HTTP.
- Auth própria (JWT do próprio backend); guard em todo endpoint protegido.
- Secrets só em `.env` (+ `.env.example`); erros internos nunca vazam ao cliente.
- Alterações de schema versionadas (MikroORM migrations **ou** `deploy/sql/` idempotente).

---

## 1. Diagnóstico — Hoje × Alvo (CLAUDE.md)

| Dimensão | Sistema atual | Alvo (CLAUDE.md) | Ação |
|---|---|---|---|
| Backend framework | Express 4 | NestJS 10 + Fastify | Reescrever |
| Arquitetura | Controllers/routes/repository plano | Hexagonal + bounded contexts | Reestruturar |
| ORM | TypeORM 0.3 | MikroORM 6 | Migrar |
| Banco | **MySQL** (mysql2) | **MySQL** (mantém) via MikroORM `@mikro-orm/mysql` | Trocar só o ORM (sem migrar de SGBD) |
| Storage de uploads | busboy → disco/local | **volume local ou MinIO** (S3-compatível) — **não** Supabase Storage | Encapsular em port de storage |
| Auth | JWT solto; `middlewares.ts` **vazio** (rotas sem guard) | JWT próprio + guards em tudo | Reescrever + fechar furo |
| Tempo real | Socket.IO em **servidor/porta separados**, sem auth, CORS `*`, payload `any`, `socket_id` no banco | **NestJS Gateway** (Socket.IO) como inbound adapter, com `WsJwtGuard` e payload validado | **Ver Seção 2** |
| Validação | Ausente/ad hoc | `class-validator` em todo DTO | Adicionar |
| Erros | `console.log`, vazam ao cliente | `GlobalExceptionFilter` + `error_reporter` port | Adicionar |
| Frontend framework | React 17 + CRA/CRACO | Next.js 14 (App Router) | Reescrever |
| UI | Tailwind (postcss7-compat) + class components | Material-UI + componentes funcionais | Reescrever |
| Forms / toasts | manual / react-toastify | react-hook-form + yup / notistack | Trocar |
| Auth no client | cookies (`universal-cookie`) | interceptor JWT em `services/api.ts` | Trocar |
| Vídeo | Daily.co + Twilio | manter (como adapter/port externo) | Encapsular |
| CORS | `origin: "*"` | por `CORS_ORIGIN` no `.env` | Corrigir |

**Furos de segurança a corrigir na migração (não são features novas, são bugs):**
1. Socket sem autenticação — qualquer um com o `session_code` injeta `ball-handler`.
2. `middlewares.ts` vazio — rotas REST efetivamente sem guard.
3. CORS `*` no HTTP e no socket.
4. Payloads de socket tipados como `any`.
5. `paciente_socket_id`/`psicologo_socket_id` persistidos no banco (quebram a cada reconexão) → trocar por **rooms** do Socket.IO.

---

## 2. DECISÃO — Socket.IO: qual saída?

**As três opções que você levantou não são concorrentes diretas.** A pergunta se
decompõe em duas:

**(A) Qual biblioteca de transporte?** → **Socket.IO (manter).**
**(B) Como integrar à arquitetura?** → **NestJS Gateway + documentar no CLAUDE.md.**

Ou seja: **use NestJS Gateway com Socket.IO E adicione a seção "Real-time Adapter" ao
CLAUDE.md.** Não é um ou outro — é os dois. **WebSocket nativo: descartado.**

### Por quê

| Critério | Socket.IO | WebSocket nativo |
|---|---|---|
| Rooms por sessão | Nativo (`join('session:<code>')`) | Você implementa à mão |
| Reconexão automática | Nativo (crítico numa sessão de terapia) | Você implementa à mão |
| Heartbeat / detecção de queda | Nativo | Você implementa à mão |
| Acknowledgements (confirmar recebimento) | Nativo | Você implementa à mão |
| Fallback / proxy (Traefik/Dokploy) | Robusto e testado | Frágil |
| Cliente atual (`socket.io-client`) | Reaproveita o protocolo | Reescreve tudo |

Para um app onde uma queda de conexão no meio de um set de reprocessamento é
disruptiva, reinventar reconexão/rooms em WS nativo é **risco alto, benefício nulo**.

### Por que Gateway (e não o servidor Socket.IO paralelo de hoje)

Hoje o Socket.IO roda num `createServer()` próprio, em outra porta, fora do container de
DI do Express. É por isso que ele tem CORS `*`, não tem auth e usa `any`. No modelo
hexagonal, o tempo real é **apenas mais um inbound adapter** (irmão do HTTP controller):

- Vive em `src/infrastructure/realtime/` (mesmo nível de `http/`, `persistence/`).
- **Não contém regra de negócio** — chama use cases, igual a um controller.
- Reusa o **mesmo `TokenServicePort`** para autenticar o handshake (`WsJwtGuard`).
- Reusa os **mesmos ports/repositórios** (ex.: `SessionRepositoryPort`).
- Valida payload com `class-validator` (WS `ValidationPipe`).
- Erros → `WsException` genérica + `error_reporter` (nunca vaza stack).

### Nota Fastify (importante)

O CLAUDE.md manda usar **Fastify**. O adapter Socket.IO do NestJS
(`@nestjs/platform-socket.io`) anexa o Socket.IO ao **mesmo servidor HTTP** do Fastify —
funciona, mas precisa registrar o `IoAdapter` no `main.ts`:

```typescript
// src/main.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
// ...após criar o app com FastifyAdapter:
app.useWebSocketAdapter(new IoAdapter(app));
```

Assim o WebSocket sobe **na mesma porta** do backend (não numa porta separada como hoje),
o que também simplifica o deploy no Dokploy (um único domínio/porta).

---

## 2.1 Banco e Redis neste projeto (decisão travada)

**Não é "MySQL ou Redis" — eles fazem papéis diferentes e podem coexistir.**

- **Fonte da verdade: MySQL (mantém).** Psicólogos, pacientes, sessões e assinaturas
  são dados duráveis e relacionais → ficam no MySQL. **Sem Supabase e sem Postgres neste
  projeto.** No MikroORM, usa-se o driver `@mikro-orm/mysql`; ports, repositórios e
  mappers permanecem idênticos ao padrão do CLAUDE.md. Vantagem: **zero migração de
  SGBD** (o sistema já é MySQL).

- **Redis: complemento opcional, ligado sob demanda.** Redis é em memória e volátil —
  **nunca** guarda dado durável. Ligue quando aparecer um destes gatilhos:
  1. **Mais de uma réplica do backend** → Redis vira **obrigatório** como *adapter* do
     Socket.IO (`@socket.io/redis-adapter`), senão os eventos não propagam entre
     instâncias. Com **uma única instância**, não precisa.
  2. **Estado efêmero de sessão/presença** (quem está conectado, estado atual da bola) →
     tira do MySQL a leitura que hoje ocorre a *cada* `ball-handler`. Ganho de latência
     no tempo real (aqui está a performance de verdade, não no SGBD).
  3. **Filas/BullMQ** para jobs em segundo plano (e-mail de convite, limpeza de salas).

- **Performance:** na escala deste app o SGBD **não é o gargalo** — o trânsito pesado do
  EMDR passa pelo WebSocket. Por isso a otimização que importa é Redis para
  presença/fan-out e escala horizontal, **não** trocar o banco relacional.

> **Regra prática:** comece **só com MySQL** (Fases 2–5). Adicione Redis na Fase 6
> **se/quando** um dos três gatilhos acima aparecer. Subir Redis no Dokploy é trivial
> (`Create Service → Database → Redis`, já previsto no playbook do CLAUDE.md).

---

## 3. Arquitetura-alvo

### Bounded contexts (backend)

| Context | Responsabilidade |
|---|---|
| `auth` | Login do psicólogo, refresh, reset de senha, verificação de e-mail. Acesso do paciente via **hash de convite** (link da sessão), sem senha. |
| `psicologo` | Cadastro, validação, perfil do psicólogo. |
| `paciente` | Cadastro/gestão de pacientes vinculados ao psicólogo. |
| `session` | Ciclo de vida da sessão EMDR: criação, `session_code`, entrada/saída, sala de vídeo. **Aggregate root da experiência em tempo real.** |
| `emdr` | Configuração do estímulo bilateral (a "bola", velocidade, tons, sons). Pode ser sub-módulo de `session`. |
| `chat` | Mensagens trocadas na sessão. |
| `video` | Integração Daily.co / Twilio (gateway externo). |
| `subscription` | Planos/assinatura do psicólogo (há página de planos + `subscription.service`). |
| `notification` | E-mail (nodemailer) — convites, reset, avisos. |

### Estrutura de pastas (segue o CLAUDE.md, com o adapter novo)

```
apps/emdr-remoto-system/backend/src/
├── contexts/
│   ├── auth/            {domain, application, auth.module.ts}
│   ├── psicologo/       {domain, application, ...}
│   ├── paciente/        {...}
│   ├── session/         {...}   ← inclui use cases chamados pelo Gateway
│   ├── chat/            {...}
│   └── subscription/    {...}
├── infrastructure/
│   ├── http/            controllers, request/response DTOs, guards
│   ├── security/        jwt-token.service, JwtAuthGuard, WsJwtGuard  ← NOVO guard
│   ├── realtime/        ★ REAL-TIME ADAPTER (Socket.IO Gateway)      ← NOVO
│   │   ├── gateways/    session.gateway.ts, emdr.gateway.ts, chat.gateway.ts
│   │   ├── dto/         ball-action.dto.ts, audio-action.dto.ts, chat-message.dto.ts
│   │   ├── guards/      ws-jwt.guard.ts
│   │   └── realtime.module.ts
│   ├── persistence/mikro-orm/  entities, repositories, mappers, migrations
│   ├── external/        daily-co.adapter.ts, twilio.adapter.ts (implementam ports)
│   └── messaging/       domain event publishers
├── config/  ·  app.module.ts  ·  main.ts
```

---

## 4. Real-time Adapter — padrão de referência

**O Gateway é adapter: fino, sem regra de negócio, chama use case.**

```typescript
// infrastructure/realtime/dto/ball-action.dto.ts
export class BallActionDto {
  @IsString() @MaxLength(40)
  type: string;                 // 'move' | 'start' | 'stop' | 'speed' ...

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  speed?: number;

  @IsOptional() @IsIn(['left', 'right', 'center'])
  direction?: string;
  // NUNCA [key: string]: any  ← proibido pelo CLAUDE.md
}
```

```typescript
// infrastructure/realtime/guards/ws-jwt.guard.ts
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort) {}

  canActivate(ctx: ExecutionContext): boolean {
    const client = ctx.switchToWs().getClient<Socket>();
    const token = client.handshake?.auth?.token;         // token no handshake, não na URL
    if (!token) throw new WsException('Unauthorized');
    try {
      client.data.user = this.tokens.verify(token);      // popula user no socket
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
```

```typescript
// infrastructure/realtime/gateways/emdr.gateway.ts
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN, credentials: true } })
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class EmdrGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly assertMembership: AssertSessionMembershipUseCase, // autorização
  ) {}

  @SubscribeMessage('ball-handler')
  async onBall(
    @ConnectedSocket() client: Socket,
    @MessageBody() action: BallActionDto,
  ): Promise<void> {
    const user = client.data.user as AuthTokenPayload;
    const code = client.data.sessionCode as string;

    // Menor privilégio: confirma que este usuário pertence a ESTA sessão
    await this.assertMembership.execute({ userId: user.sub, role: user.role, code });

    // Emite para a ROOM da sessão (não para socket_id gravado no banco)
    client.to(`session:${code}`).emit('ball-handler', action);
  }
}
```

**Diferenças-chave para o código de hoje:**
- Room `session:<code>` em vez de `paciente_socket_id`/`psicologo_socket_id` no banco.
- Auth no handshake + autorização por use case (`AssertSessionMembership`).
- Payload tipado e validado.
- `join-session` valida que o token pertence à sessão antes de `client.join(...)`.

### Cliente (Next.js) — hook único

```typescript
// frontend: src/hooks/useEmdrSocket.ts
const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
// substitui a classe WebsocketServer atual; token vem do JWT próprio
```

---

## 5. Emenda ao CLAUDE.md (texto pronto para colar)

> Cole isto como uma nova seção **antes** de "## Testing Strategy" (ou onde preferir).
> Isto trava a decisão para todos os apps do monorepo que precisarem de tempo real.

```markdown
## Real-time Adapter (WebSocket) — Socket.IO via NestJS Gateway

Quando um sistema precisar de comunicação em tempo real (ex.: EMDR Remoto —
estímulo bilateral, chat de sessão, presença), o transporte padrão é **Socket.IO**,
integrado como **inbound adapter** via **NestJS Gateway** (`@nestjs/websockets` +
`@nestjs/platform-socket.io`). **Não usar WebSocket nativo** (reimplementaria rooms,
reconexão, heartbeat e acks manualmente) nem servidor Socket.IO paralelo fora do
container de DI.

**Regras (mesmas do HTTP Adapter, aplicadas ao socket):**
- O Gateway vive em `src/infrastructure/realtime/` e é **fino**: valida, autentica,
  chama Use Case, emite. **Nenhuma regra de negócio no Gateway.**
- **Autenticação no handshake** via `WsJwtGuard`, que reusa o `TokenServicePort`.
  Token em `handshake.auth.token` — nunca na query string.
- **Autorização contextual**: antes de entrar numa room ou emitir, um Use Case
  confirma que o usuário autenticado pertence àquela sessão (menor privilégio).
- **Todo payload é um DTO com `class-validator`** (WS `ValidationPipe` com
  `whitelist: true`). Proibido `any` ou `[key: string]: any`.
- **Rooms** (`session:<code>`) para roteamento — nunca persistir `socket_id` no banco.
- **CORS** do Gateway lido de `CORS_ORIGIN` (nunca `*` com credenciais).
- Erros → `WsException` com mensagem genérica; 500/inesperado reportado pelo
  `error_reporter` port (fire-and-forget). Nunca vazar stack pelo socket.
- **Fastify**: registrar `app.useWebSocketAdapter(new IoAdapter(app))` no `main.ts`;
  o Socket.IO sobe na mesma porta do backend (um único domínio no Dokploy).

**Estrutura:**
`realtime/{gateways, dto, guards, realtime.module.ts}`. Um Gateway por
domínio de eventos (session, emdr, chat), todos importando os Use Cases do context
correspondente. Contrato de eventos versionado (nomes de eventos como constantes
compartilhadas entre back e front).
```

---

## 6. Plano faseado (passo a passo)

Cada fase tem um **Definition of Done (DoD)**. Só avance quando o DoD passar.

### Fase 0 — Fundação
- Criar `apps/emdr-remoto-system/{backend,frontend}` no monorepo, reusando
  `@gitspread/domain-primitives` e `@gitspread/shared-kernel`.
- Backend: skeleton NestJS + Fastify + `main.ts` (ValidationPipe global,
  GlobalExceptionFilter, CORS por env, `IoAdapter`).
- **DoD:** `npm run dev` sobe o backend; `/api/health` responde; `typecheck` limpo.

### Fase 1 — Governança
- Colar a emenda da **Seção 5** no `CLAUDE.md`. Travar a decisão Socket.IO.
- **DoD:** CLAUDE.md contém a seção "Real-time Adapter".

### Fase 2 — Persistência (TypeORM → MikroORM, **mantendo o MySQL**)
- Configurar MikroORM com driver `@mikro-orm/mysql` (mesmo banco MySQL atual).
- Modelar ORM entities (Seção 7), mappers e repositórios (ports em application).
- Migrations MikroORM **ou** `deploy/sql/NN_*.sql` idempotente.
- **Sem migração de SGBD** — o schema já existe em MySQL; só reescreve a camada de ORM.
  Se decidir trocar PK `int`→`uuid`, aí sim há script de transformação (opcional).
- **DoD:** MikroORM conecta no MySQL; repositórios com testes de integração verdes.

### Fase 3 — Auth própria + guards
- `auth` context: login psicólogo (bcrypt), refresh, reset (nodemailer), verificação
  de e-mail. Acesso do paciente por **hash de convite** (sem senha).
- `JwtAuthGuard` + `WsJwtGuard`. Fechar o furo do `middlewares.ts` vazio.
- **DoD:** rota protegida sem token = 401; socket sem token = recusado; testes de auth.

### Fase 4 — Contexts REST
- `psicologo`, `paciente`, `session` (criar sessão + sala Daily.co), `subscription`.
- Controllers finos, Response DTOs (sem campos sensíveis), use cases com UnitOfWork.
- **DoD:** CRUD e criação de sessão funcionando; nenhum domain entity exposto.

### Fase 5 — Real-time Gateway
- `realtime/`: `SessionGateway` (join/leave/presença), `EmdrGateway`
  (`ball-handler`, `audio-handler`), `ChatGateway` (`new-message`, `update-messages`).
- Migrar contrato de eventos (Seção 8) com autorização por sessão e rooms.
- **DoD:** dois clientes na mesma sessão trocam ball/audio/chat; reconexão OK;
  usuário fora da sessão é bloqueado.

### Fase 6 — Integrações externas + cron (+ Redis se necessário)
- `video` port + adapters Daily.co/Twilio. `notification` (nodemailer).
- Cron de limpeza de salas antigas (hoje em `app.ts`) como scheduled task NestJS.
- **Redis (condicional):** ligar agora **se** houver >1 réplica do backend (adapter do
  Socket.IO), estado de presença em memória, ou filas BullMQ (ver Seção 2.1).
- **DoD:** criar/entrar em sala de vídeo; cron remove salas ociosas; (se ligado) Socket.IO
  propaga eventos entre réplicas via Redis.

### Fase 7 — Frontend Next.js 14 + MUI
- Migrar páginas: landing, login/cadastro/validação psicólogo, home (lista de
  pacientes/sessões), prejoin, **emdr** (o coração — reescrever o class component de
  1172 linhas em componentes funcionais + `useEmdrSocket`), chamada encerrada, planos.
- `services/api.ts` com interceptor JWT; forms com react-hook-form + yup; notistack.
- **DoD:** fluxo psicólogo→sessão→paciente ponta a ponta no navegador.

### Fase 8 — Testes + Deploy
- Cobertura domain/application > 80%; e2e do fluxo de sessão.
- Deploy no project `emdrremoto` (playbook Dokploy do CLAUDE.md): backend + frontend +
  Redis (**apenas se** ligado na Fase 6). Atualizar OAuth/redirect do Daily.co para o domínio público.
- **DoD:** `emdrremoto.com.br` no ar com HTTPS; sessão real time funcionando em prod.

---

## 7. Mapeamento de dados (TypeORM → MikroORM, **mesmo MySQL**)

| Entidade atual | Campos hoje | Observações na migração |
|---|---|---|
| `Psicologo` | email, nome, telefone, codigo_recuperacao, senha, email_verificado (+ id, status, timestamps) | `senha` → `passwordHash`; nunca em Response DTO. |
| `Paciente` | email, nome, pais, telefone, hash (+ base) | `hash` = token de convite/acesso à sessão; tratar como credencial. |
| `Sessions` | session_id, session_code, daily_co_name, paciente_in, psicologo_in, session_out, **paciente_socket_id**, **psicologo_socket_id** | **Remover os dois `*_socket_id`** — substituídos por rooms Socket.IO. FKs psicólogo/paciente. |

- `MasterModel` (id int auto, status bool, created_at/updated_at) → base MikroORM.
  Manter PK `int` (o schema MySQL já usa) — trocar para `uuid` é **opcional** e só se
  quiser uniformidade com os outros apps do GitSpread (exige script de transformação).
- Datas: preservar os tipos `timestamp`/`datetime` já existentes no MySQL.

---

## 8. Inventário de eventos Socket.IO (contrato tipado)

Nomes atuais a preservar (definir como constantes compartilhadas back/front):

| Evento | Direção | Payload → DTO | Context |
|---|---|---|---|
| `join-session` | client→server | `{ session_code, user:{type} }` → `JoinSessionDto` | session |
| `ball-handler` | bidirecional | `iAction` → **`BallActionDto`** | emdr |
| `audio-handler` | bidirecional | `iAction` → **`AudioActionDto`** | emdr |
| `new-message` | bidirecional | `{ ... }` → **`ChatMessageDto`** | chat |
| `update-messages` | bidirecional | lista → **`ChatSyncDto`** | chat |
| `start-cron` | server→client | sinal | session |
| `end-call` / `user-joined` / `disconnect_user` | mistos | `{ room, user }` → DTOs | session |
| `terapeuta_conectado_video` / `pacient_name` | client→server | `{ room, name }` → DTO | session/video |

Todos passam a exigir: socket autenticado (`WsJwtGuard`) + payload validado +
autorização de pertencimento à sessão + roteamento por room.

---

## 9. Checklist Security by Design — tempo real (validação final)

- [ ] Handshake do socket autenticado (`WsJwtGuard`, token em `handshake.auth`).
- [ ] Autorização por sessão antes de `join`/`emit` (usuário pertence à sessão).
- [ ] Todo payload de evento é DTO com `class-validator` (nenhum `any`).
- [ ] Roteamento por room `session:<code>` — nenhum `socket_id` persistido.
- [ ] CORS do Gateway por `CORS_ORIGIN` (sem `*` com credenciais).
- [ ] `WsException` genérica ao cliente; 500 reportado por `error_reporter`.
- [ ] `IoAdapter` registrado no `main.ts` (compat Fastify; porta única).
- [ ] Nomes de eventos como constantes compartilhadas (sem string mágica solta).
```
