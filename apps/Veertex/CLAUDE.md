# CLAUDE.md

> **ONDE ESTE CÓDIGO VIVE** (atualizado em 13/08/2026 — leia antes de procurar arquivo)
>
> O trabalho acontece **no monorepo `project_structure`, em `apps/Veertex/`**. Este diretório é a
> raiz do Veertex: `backend/`, `frontend/`, `packages/` e `Requisitos/` são workspaces de primeiro
> nível **dentro dele** — não há `apps/<app>-system/` aqui dentro.
>
> O repositório `gitlab.com/eliab1/veertex` continua existindo, e é o que o **Dokploy** builda: ele
> é **publicado** a partir daqui por `git subtree split --prefix=apps/Veertex`. Por isso este
> diretório tem `package.json`, `package-lock.json` e `tsconfig.base.json` PRÓPRIOS: quando o subtree
> vira repositório, esta pasta é a raiz dele, e é essa forma que os `Dockerfile` assumem
> (`COPY backend ./backend`). O histórico dos 19 commits do período em que o Veertex foi um
> repositório separado está preservado sob a tag **`pre-monorepo`** no GitLab.
>
> Os pacotes compartilhados (`@veertex/domain-primitives`, `@veertex/shared-kernel`) são CÓPIAS em
> `apps/Veertex/packages/`, **distintas** das de `packages/` na raiz do monorepo (que usam o escopo
> `@gitspread/*` e servem os outros cinco apps). São 13 arquivos de classes-base estáveis e sem
> dependências. O escopo diferente não é detalhe: é o que faz uma divergência entre as duas cópias
> aparecer como erro de compilação em vez de silêncio.
>
> Este arquivo herdou o texto do monorepo e foi alinhado ao Veertex em 10/08/2026: caminhos,
> escopo dos pacotes, stack (banco e storage), guards, claims do token e exemplos. **As regras não
> foram alteradas.** O que o produto É vive em `Requisitos/00_Veertex_Visao_Geral.md`; este arquivo
> governa COMO se escreve o código.


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Projeto pessoal e independente.** O que o Veertex É está em
> `Requisitos/00_Veertex_Visao_Geral.md` — este arquivo governa COMO se escreve o código.
> **Não tem qualquer vínculo com sistemas de autenticação corporativa de terceiros.** Toda a
> autenticação é **própria** (JWT emitido pelo próprio backend). Nunca introduza dependências,
> URLs, secrets ou fluxos de autenticação ligados a provedores de identidade externos ou a
> qualquer infraestrutura corporativa de terceiros.

## Comportamento Obrigatório — Leia Antes de Qualquer Coisa

**Claude Code DEVE seguir estas regras em TODO código gerado neste projeto,
sem precisar que o usuário solicite explicitamente:**

1. **Security by Design é inegociável** — segurança não é uma feature, é estrutural.
   Aplique os padrões de segurança mesmo que o requisito não mencione segurança.

2. **Todo endpoint protegido DEVE ter o guard adequado** — `@UseGuards(JwtAuthGuard)` para
   qualquer usuário autenticado, `@UseGuards(PermissionGuard)` + `@RequirePermission(...)` quando a
   operação exige permissão, `@UseGuards(ModuleGuard)` + `@RequireModule(...)` em controller de
   módulo opcional. Endpoint que expõe dados sem guard é um **bug**, não uma escolha — exceções
   (rotas públicas) precisam de comentário explicando o motivo.

3. **Todo DTO de request DEVE ter validações `class-validator`** em todos os campos.
   Nunca gere um DTO sem decorators de validação.

4. **Nunca exponha domain entity via HTTP** — sempre mapeie para ResponseDto.
   Nunca inclua campos sensíveis (senha, hash, token, secret) em response DTOs.

5. **Nunca hardcode secrets** — qualquer valor sensível (JWT secret, senha de banco,
   senha do MinIO, apikey do Evolution, SMTP) vai para `.env`. Se criar nova variável de ambiente,
   atualize também o `.env.example`.

6. **Erros internos nunca chegam ao cliente** — use o GlobalExceptionFilter.
   Mensagem genérica para o cliente; detalhe completo no log interno.

7. **Se o usuário pedir algo que viola segurança**, implemente de forma segura
   e explique o motivo da diferença. Nunca implemente o padrão inseguro.

8. **Alterações de banco** seguem o padrão MikroORM (migrations versionadas) ou, quando
   indicado, scripts SQL idempotentes em `deploy/sql/`. Nunca altere o schema direto no
   banco de produção sem deixar o artefato versionado no repositório.

9. **Toda entidade que faz login DEVE ter nome, e-mail e WhatsApp — os três obrigatórios.**
   Não existe usuário autenticável sem WhatsApp, porque a **recuperação de senha é por código
   enviado no WhatsApp** (ver *Recuperação de Senha por Código no WhatsApp*). Um usuário sem
   número cadastrado é um usuário que perde a conta no primeiro esquecimento de senha — e o
   suporte só consegue devolvê-la com acesso ao banco. A obrigatoriedade vale nas três camadas:
   - **Request DTO**: os três campos obrigatórios, nunca `@IsOptional()`;
   - **Domínio**: o telefone é Value Object (`PhoneE164`), nunca `string` solta;
   - **Schema**: coluna `NOT NULL`.

   Único caso em que o telefone pode ser nulo: coluna adicionada a uma tabela que **já tem
   linhas** em produção. Aí entra como nullable, e a migration seguinte a torna `NOT NULL`
   depois do backfill — a nulidade é transitória e documentada, não um padrão.

10. **Se a aplicação for em Python (não-NestJS), o `CLAUDE_PYTHON.md` é leitura
    obrigatória ANTES de gerar qualquer código.** Ele define a arquitetura
    **Hexagonal Python** (FastAPI + SQLAlchemy + Pydantic; port no limite da persistência;
    `import-linter`; exceções tipadas; `response_model`). Todas as regras transversais deste
    `CLAUDE.md` (autenticação JWT própria, Security by Design, CORS, validação, frontend)
    continuam valendo — o `CLAUDE_PYTHON.md` define apenas COMO aplicá-las na stack Python.

---

## Communication Language

**IMPORTANT**: All conversations with the user MUST be conducted in **Portuguese (pt-BR)**.
- Respond to user questions in Portuguese
- Provide explanations and documentation in Portuguese
- Code comments can remain in English (following standard conventions)
- Variable names, function names, and technical identifiers MUST remain in English

## Estrutura do repositório

Repositório **próprio do Veertex**, com **npm workspaces** e **arquitetura hexagonal**
(Ports & Adapters). Quatro diretórios de primeiro nível:

- **`backend/`** — API NestJS 10 + Fastify + MikroORM 6 (PostgreSQL)
- **`frontend/`** — Next.js 14 (App Router) + Material-UI
- **`packages/`** — bibliotecas compartilhadas: `@veertex/domain-primitives`,
  `@veertex/shared-kernel`
- **`Requisitos/`** — requisitos, decisões de arquitetura (ADRs) e instruções

> **Os pacotes de `packages/` são CÓPIAS**, não referência ao monorepo de origem. Correção feita
> aqui não chega ao `project_structure`, e vice-versa. Ver `Requisitos/ADR-0002_Pacotes_Copiados.md`.

### Stack

| Camada | Tecnologia |
|---|---|
| Backend framework | **NestJS 10** + **Fastify** (adapter) |
| ORM | **MikroORM 6** (driver PostgreSQL) |
| Banco | **PostgreSQL self-hosted** no servidor mdantas (driver `postgresql`, conexão direta) |
| Storage de arquivos | **MinIO** (fotos de produto, evidências de rota, XMLs, PDFs) |
| Auth | **JWT próprio** (`jsonwebtoken` + `bcryptjs`) — sem terceiros de identidade |
| E-mail | **nodemailer** (reset de senha, notificações) |
| Frontend | **Next.js 14** (App Router) + **Material-UI** + Emotion/styled-components |
| Forms | **react-hook-form** + **yup** |
| Notificações UI | **notistack** |
| Linguagem | **TypeScript** (strict mode) |

> **O banco é PostgreSQL self-hosted, e isso não é uma preferência.** O isolamento entre contas
> depende de **Row Level Security** e de **dois papéis de banco** (`veertex_owner` com DDL,
> `veertex_app` sem) — ver `Requisitos/00_Veertex_Visao_Geral.md` §3. Um Postgres gerenciado que não
> permita criar papéis com atributos controlados, ou onde a aplicação conecte como dono das tabelas,
> torna o RLS decorativo. Trocar de banco não é ajustar um driver: é refazer a fundação do
> isolamento.

### Contexts (bounded contexts do backend)

**F1 (em `main`):** `plan`, `account`, `company`, `role`, `user`, `auth`.
**F2 (em `feat/f2-modules`, sem merge até a F1 fechar):** `module`.

**Previstos** (Visão Geral §4): `contact`, `product`, `order`, `commission`, `stock`, `trip`,
`collection`, `fiscal`, `channel`, `fulfillment`.

## Essential Commands

### Root-level
```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all workspaces
npm run lint                   # Lint + fix entire codebase
npm run format                 # Format with Prettier
npm run typecheck              # TypeScript type checking
npm run test:unit              # Unit tests
npm run test:integration       # Integration tests
npm run test:e2e               # E2E tests
```

### Backend (`backend`)
```bash
cd backend

# Development
npm run dev                    # Start with watch mode (porta 3020)
npm run dev:debug              # Start with debugging enabled

# Database (MikroORM + PostgreSQL)
npm run migration:create -- --name=YourMigrationName
npm run migration:up           # Run pending migrations
npm run migration:down         # Rollback last migration
npm run schema:fresh           # Drop schema + run migrations (CUIDADO: apaga dados)
npm run seed                   # Run database seeders

# Operação
npm run create:admin           # Cria usuário admin
npm run reset:password         # Reset de senha de um usuário

# Testing
npm run test                   # Run all tests
npm run test:watch             # Watch mode
npm run test:cov               # Coverage report
npm run test -- path/to/test.spec.ts  # Single test file
```

### Frontend (`frontend`)
```bash
cd frontend

npm run dev                    # Next.js dev server (porta 3021)
npm run build                  # Production build
npm run start                  # Serve production build (porta 3021)
npm run lint                   # ESLint (--max-warnings=0)
```

## Architecture Principles

### Hexagonal Architecture (Ports & Adapters)

**Dependency Rule**: Dependencies flow inward only: Infrastructure → Application → Domain

```
┌─────────────────────────────────┐
│     Infrastructure Layer        │  ← Adapters (HTTP, DB, Messaging, Storage)
│  ┌───────────────────────────┐  │
│  │   Application Layer       │  │  ← Use Cases, Ports (interfaces), DTOs
│  │  ┌─────────────────────┐  │  │
│  │  │   Domain Layer      │  │  │  ← Pure business logic
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Three-Layer Structure

#### 1. Domain Layer (`src/contexts/<context>/domain/`)
- **Entities**: Business objects with identity (extend `AggregateRoot` for root entities)
- **Value Objects**: Immutable objects without identity (extend `ValueObject`)
- **Domain Events**: Events emitted by aggregates (extend `DomainEvent`)
- **Domain Exceptions**: Business rule violations (extend `DomainException`)
- **NO framework dependencies** - pure TypeScript classes

#### 2. Application Layer (`src/contexts/<context>/application/`)
- **Use Cases**: Orchestrate domain logic, implement business workflows
- **Ports**: Define interfaces (contracts)
  - `ports/input/`: Command/Query interfaces (optional, use cases can be the interface)
  - `ports/output/`: Repository, gateway interfaces (e.g., `UserRepositoryPort`)
- **DTOs**: Data transfer objects for application boundaries
- **Commands/Queries**: Input structures for use cases

#### 3. Infrastructure Layer (`src/infrastructure/`)
- **HTTP Adapter** (`http/`): NestJS controllers, request/response DTOs, guards
- **Security** (`security/`): JWT token service, tenant context, guards (`JwtAuthGuard`, `PermissionGuard`, `ModuleGuard`)
- **Persistence Adapter** (`persistence/mikro-orm/`):
  - `entities/`: ORM entities with MikroORM decorators (suffix: `-orm.entity.ts`)
  - `repositories/`: Implement domain repository ports
  - `mappers/`: Convert between domain entities and ORM entities
  - `migrations/`: MikroORM migrations
- **Messaging Adapter** (`messaging/`): Event publishers/subscribers
- **Storage Adapter**: MinIO (uploads de imagens, XMLs, PDFs) — ainda não implementado na F1

## Security by Design

**Todo desenvolvimento neste projeto aplica Security by Design.**
Segurança é incorporada em cada decisão de código e arquitetura —
não adicionada depois como correção.

### Princípio 1 — Minimize a Superfície de Ataque

Exponha apenas o estritamente necessário. Cada endpoint, campo e método
público é uma superfície potencial de ataque.

```typescript
// ❌ ERRADO — sem guard, expõe domain entity, sem tipagem de retorno
@Get(':id')
async getUser(@Param('id') id: string) {
  return this.userRepository.findById(id); // expõe internals do domínio
}

// ✅ CORRETO — superfície controlada em todas as dimensões
@Get(':id')
@UseGuards(PermissionGuard)
@RequirePermission(PERMISSIONS.users.read)
async getUser(@Param('id') id: string): Promise<UserResponseDto> {
  return this.getUserUseCase.execute({ id });
  // getUserUseCase retorna UserResponseDto — nunca a domain entity
}
```

**Regras:**
- Guard adequado (`JwtAuthGuard` / `PermissionGuard` / `ModuleGuard`) em todo controller ou método que expõe dados
- Response DTOs com `static fromDomain()` — nunca retornar domain entity diretamente
- Campos sensíveis (`passwordHash`, `token`, `secret`) **nunca** aparecem em response DTOs
- Endpoint público (health, login, refresh, recuperação de senha) deve ter comentário explicando o motivo

### Princípio 2 — Nunca Confie em Inputs Externos (Never Trust Input)

Todo dado que vem de fora é potencialmente malicioso. Valide em **duas camadas
independentes** — cada camada valida o que lhe pertence, sem assumir que a
camada anterior já garantiu a segurança.

**Camada 1 — HTTP (Request DTO):** rejeita dados malformados antes do Use Case

```typescript
// ✅ Todo campo validado — comprimento, formato, caracteres permitidos
export class CreateUserRequestDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-ZÀ-ÿ\s]+$/, { message: 'Nome deve conter apenas letras' })
  name: string;

  // ❌ NUNCA: campo sem nenhum decorator de validação
  // unsafeField: string;
}
```

**Camada 2 — Domain (Value Object):** garante invariantes de negócio

```typescript
// ✅ Value Object valida no construtor — entidade nunca em estado inválido
export class CPF extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!this.isValid(props.value)) {
      throw new InvalidCpfException(props.value);
    }
  }

  static create(value: string): CPF {
    return new CPF({ value: onlyDigits(value) });
  }

  private isValid(cpf: string): boolean {
    return ValidationUtil.isValidCPF(cpf);
  }
}
```

### Princípio 3 — Falhe com Segurança (Fail Securely)

Erros internos **nunca** expõem detalhes de infraestrutura ao cliente.
Stack traces, queries SQL e mensagens de ORM ficam nos logs internos.

```typescript
// ❌ ERRADO — vaza stack trace e detalhes internos para o cliente
catch (error) {
  return res.status(500).json({
    error: error.message,   // pode conter query SQL, path de arquivo, etc.
    stack: error.stack,     // NUNCA expor ao cliente
  });
}

// ✅ CORRETO — mensagem genérica para o cliente, detalhe no log
catch (error) {
  this.logger.error('Erro ao processar solicitação', {
    error,
    userId: command.userId, // contexto útil para debug, sem dados sensíveis
  });
  throw new InternalServerErrorException('Erro ao processar solicitação');
}
```

**GlobalExceptionFilter — recomendado em `src/main.ts`:**

```typescript
// src/infrastructure/http/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // DomainException → 400 Bad Request (mensagem de negócio é segura de expor)
    if (exception instanceof DomainException) {
      response.status(400).send({ message: exception.message });
      return;
    }

    // HttpException do NestJS → repassa status e mensagem controlada
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).send(exception.getResponse());
      return;
    }

    // Qualquer outro erro → 500 genérico (nunca expõe detalhes)
    this.logger.error('Unhandled exception', {
      exception,
      path: request.url,
      method: request.method,
    });
    response.status(500).send({ message: 'Erro interno. Tente novamente.' });
  }
}

// src/main.ts — registrar globalmente
app.useGlobalFilters(new GlobalExceptionFilter());
```

### Princípio 4 — Defense in Depth (Defesa em Profundidade)

Múltiplas camadas independentes de proteção. Se uma falhar, as outras protegem.
**Nunca assuma que a camada anterior garantiu a segurança.**

```
Request HTTP
  → [1] CORS              — apenas origens autorizadas (CORS_ORIGIN no .env)
  → [2] Guard (JWT)       — token JWT válido e não expirado; role correta
  → [3] ValidationPipe    — DTO válido (class-validator em todos os campos)
  → [4] Use Case          — regras de negócio e autorização contextual
  → [5] Domain Entity     — invariantes de domínio (Value Objects no construtor)
  → [6] ORM (MikroORM)    — queries parametrizadas (previne SQL Injection)
```

Cada camada é **independente** — a falha de uma não compromete as demais.

### Princípio 5 — Menor Privilégio

Cada componente acessa apenas o que precisa, nada além.

```typescript
// ❌ ERRADO — Use Case acessa EntityManager (acesso irrestrito ao banco)
@Injectable()
export class GetUserUseCase {
  constructor(private readonly em: EntityManager) {} // acesso total ao banco
}

// ✅ CORRETO — Use Case acessa apenas a interface que precisa
@Injectable()
export class GetUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort, // interface mínima
  ) {}
}
```

**Regras:**
- Use Cases injetam apenas os repositórios do seu contexto
- JWT payload com apenas os claims necessários (`sub`, `accountId`, `roleId`, `permissions`) — sem dados desnecessários
- Guards aplicados no nível mais restritivo (método > controller)
- **Carteirização** (`01_Veertex_Core.md` §3.4): com a preferência "contato acessível somente ao
  vendedor vinculado" ligada, o vendedor enxerga apenas a própria carteira — e o filtro sai do
  `sub` do TOKEN, **nunca** de body/query/header. Vale para todo escopo por ator: se o cliente
  puder dizer de quem são os dados que quer ver, ele vai dizer

### Princípio 6 — Separação e Isolamento

Componentes isolados limitam o impacto de uma falha ou comprometimento.

```typescript
// ✅ Domain Layer completamente isolada — sem dependências externas
export class Company extends AggregateRoot {
  // SEM imports de NestJS, MikroORM, Fastify, axios, MinIO, etc.
  // Apenas TypeScript puro e os packages/ do próprio repositório
  private constructor(
    private readonly _id: CompanyId,     // Value Object — valida no construtor
    private readonly _document: Document, // Value Object — CNPJ, valida dígito no construtor
    private _legalName: string,
  ) { super(); }
}
```

**Secrets exclusivamente em `.env`** — nunca em código, nunca em logs:

```typescript
// ❌ NUNCA — secret hardcodado no código
const JWT_SECRET = 'minha-chave-super-secreta';

// ❌ NUNCA — logar dados sensíveis
this.logger.log(`Token gerado: ${token}`);
this.logger.log(`Senha recebida: ${password}`);

// ✅ CORRETO — secret via variável de ambiente
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) throw new Error('JWT_ACCESS_SECRET não configurado');

// ✅ CORRETO — log sem dados sensíveis
this.logger.log('Usuário autenticado', { userId: user.id, role: user.role });
```

### Regras Absolutas — Nunca Violadas

```
❌ Hardcodar secrets, senhas ou tokens no código
❌ Logar dados sensíveis (senhas, hashes, tokens, CPF, dados de cartão/pagamento)
❌ Retornar stack traces ou mensagens de ORM para o cliente
❌ Criar endpoint protegido sem guard sem comentário documentando o motivo
❌ Criar campo em DTO sem decorator de validação class-validator
❌ Retornar domain entity diretamente via HTTP (sempre usar ResponseDto)
❌ Usar `any` em dados vindos de fora (HTTP, banco, eventos externos)
❌ Criar nova variável de ambiente sem adicionar ao .env.example
❌ Introduzir qualquer dependência/URL/fluxo ligado a provedores de identidade externos
```

### Response DTO — Campo Sensível Nunca Mapeado

```typescript
// ❌ ERRADO — expõe campos internos e sensíveis
export class UserResponseDto {
  id: string;
  email: string;
  passwordHash: string;  // NUNCA
  resetToken: string;    // NUNCA
}

// ✅ CORRETO — apenas o que o cliente precisa ver, mapeado explicitamente
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id.value;
    dto.email = user.email.value;
    dto.name = user.name;
    dto.role = user.role;
    dto.createdAt = user.createdAt;
    // passwordHash nunca é mapeado — ausência intencional
    return dto;
  }
}
```

### Endpoint Público — Exceção Documentada

Alguns endpoints genuinamente não exigem autenticação — e cada um precisa dizer por quê:

```typescript
// PÚBLICO — é onde a autenticação começa, então não pode exigir autenticação.
// Proteção: falhas opacas (sem enumeração de contas), bcrypt cost 12, tentativa no log.
// @UseGuards(...) — intencionalmente ausente (ver motivo acima)
@Post('login')
@HttpCode(200)
async login(@Body() dto: LoginRequestDto, @ClientIp() ip: string | null): Promise<LoginResponseDto> {
  return LoginResponseDto.from(await this.loginUseCase.execute(new LoginCommand(dto.email, dto.password, ip)));
}
```

---

## Critical Patterns

### 1. Dependency Injection with Symbols

Always use TypeScript Symbols for port tokens (type-safe DI):

```typescript
// Define in port file
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// Register in module
providers: [{
  provide: USER_REPOSITORY,
  useClass: MikroOrmUserRepository,
}]

// Inject in use case
constructor(
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepositoryPort,
) {}
```

### 2. Domain Entity ≠ ORM Entity (Always Separate)

**Domain Entity** (pure, no decorators):
```typescript
// src/contexts/user/domain/entities/user.entity.ts
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _email: Email,
    // ...
  ) { super(); }

  static create(email: Email, name: string): User {
    const user = new User(/*...*/);
    user.addDomainEvent(new UserCreatedEvent(/*...*/));
    return user;
  }
}
```

**ORM Entity** (with MikroORM decorators — PostgreSQL):
```typescript
// src/infrastructure/persistence/mikro-orm/entities/user-orm.entity.ts
@Entity({ tableName: 'users' })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' }) id: string;
  @Property() email: string;
  // ...
}
```

**Mapper** (bidirectional conversion):
```typescript
// src/infrastructure/persistence/mikro-orm/mappers/user.mapper.ts
@Injectable()
export class UserMapper {
  toDomain(orm: UserOrmEntity): User { /*...*/ }
  toOrm(domain: User): UserOrmEntity { /*...*/ }
}
```

### 3. Unit of Work / EntityManager

> **⚠️ MikroORM nota importante (do histórico do projeto):** `EntityRepository` **não**
> possui `persistAndFlush`. Repositórios que precisam persistir devem **injetar o
> `EntityManager`** e chamar `em.persistAndFlush(...)`. Nunca chame `repository.persistAndFlush()`.

Prefira a abstração `UnitOfWorkPort` nos use cases para controlar transação:

```typescript
// Use case
async execute(command: CreateOrderCommand): Promise<OrderDto> {
  return this.unitOfWork.execute(async () => {
    // All operations here run in a transaction
    const saved = await this.orderRepository.save(order);
    await this.commissionRepository.save(commission);
    return OrderDto.fromDomain(saved);
  });
}
```

### 4. Domain Events Flow

1. **Entity emits**: `this.addDomainEvent(new AccountCreatedEvent(...))`
2. **Repository publishes** (after successful persistence):
   ```typescript
   const events = account.pullDomainEvents();
   await this.eventPublisher.publishAll(events);
   ```
3. **Handlers react**:
   ```typescript
   @OnEvent('account.created')
   async handle(event: AccountCreatedEvent) { /*...*/ }
   ```

## Adding New Features

### Creating a New Bounded Context

1. **Create folder structure**: `src/contexts/<context-name>/`
   - `domain/` (entities, VOs, events, exceptions)
   - `application/` (use-cases, ports, DTOs)
   - `<context-name>.module.ts`

2. **Domain Layer**: entities (extend `AggregateRoot`), value objects (extend `ValueObject`),
   domain events (extend `DomainEvent`), domain exceptions (extend `DomainException`)

3. **Application Layer**: repository ports in `application/ports/output/`,
   use cases implementing `UseCase<TCommand, TResult>`, DTOs

4. **Infrastructure Layer**: ORM entities, repositories, mappers, HTTP controllers + guards

5. **Module Configuration**: DI in `<context-name>.module.ts`,
   `MikroOrmModule.forFeature([OrmEntity])`, repositories with Symbol tokens, export use cases

6. **Register Module**: import in `app.module.ts`

7. **Security by Design Checklist** — verificar antes de considerar a feature completa.
   Claude Code aplica estes itens automaticamente; use como validação final:

   **Autenticação e Autorização:**
   - [ ] Todos os endpoints protegidos têm guard (`JwtAuthGuard`/`PermissionGuard`/`ModuleGuard`) ou comentário documentando ausência
   - [ ] Endpoints com escopo por ator (ex.: carteirização de contatos, §3.4) filtram pelo id do TOKEN no Use Case — nunca por body/query/header

   **Validação de Dados:**
   - [ ] Todos os campos do Request DTO têm decorators `class-validator`
   - [ ] Value Objects validam invariantes no construtor (nunca estado inválido)
   - [ ] `ValidationPipe` ativo globalmente no `main.ts` (`whitelist: true`, `forbidNonWhitelisted: true`)

   **Exposição de Dados:**
   - [ ] Response DTOs não contêm campos sensíveis (`passwordHash`, tokens, etc.)
   - [ ] `static fromDomain()` mapeia explicitamente — nunca retorna domain entity direta
   - [ ] Erros internos não vazam para o cliente

   **Configuração e Secrets:**
   - [ ] Nenhum secret hardcodado — tudo em `.env`
   - [ ] Novas variáveis de ambiente adicionadas ao `.env.example`
   - [ ] `CORS_ORIGIN` configurado no `.env` do ambiente

   **Logs:**
   - [ ] Dados sensíveis ausentes dos logs (senhas, tokens, CPF, dados de pagamento)
   - [ ] Erros logados com contexto suficiente para debug

### Adding a New Use Case (Example)

```typescript
// 1. Create command/query
export class UpdateUserNameCommand {
  constructor(
    public readonly userId: string,
    public readonly newName: string,
  ) {}
}

// 2. Create use case
@Injectable()
export class UpdateUserNameUseCase implements UseCase<UpdateUserNameCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(cmd: UpdateUserNameCommand): Promise<UserDto> {
    const user = await this.repo.findById(UserId.from(cmd.userId));
    if (!user) throw new UserNotFoundException(cmd.userId);

    user.changeName(cmd.newName);

    return this.uow.execute(async () => {
      const saved = await this.repo.save(user);
      return UserDto.fromDomain(saved);
    });
  }
}

// 3. Register in module providers + exports
// 4. Inject in controller and create endpoint with the proper guard
```

> **Atenção aos paths relativos:** de `use-cases/<name>/` até `domain/` são **3 níveis**
> (`../../../domain/`), não 2. Erro comum ao criar use cases novos.

## Authentication System (Própria — sem terceiros)

> **A autenticação é 100% própria.** Não há provedor de identidade externo nem iframe de
> terceiros. O backend emite e valida seus próprios JWTs.

### Fluxo

1. **Login** — usuário envia **e-mail + senha** (`/api/auth/login`). O backend valida a senha
   com `bcryptjs`, emite um **access token** (JWT curto) e um **refresh token**.
2. **Login admin** — fluxo separado (`/api/auth/login-admin`) para a área administrativa.
3. **Refresh** — `/api/auth/refresh` troca o refresh token por um novo access token.
4. **Me** — `/api/auth/me` retorna o usuário autenticado a partir do token.
5. **Reset de senha** — `request-password-reset` envia e-mail (nodemailer) com token;
   `reset-password` troca a senha.

### JWT — Token Service e Payload

O `TokenServicePort` (Symbol `TOKEN_SERVICE`) abstrai a emissão/validação de tokens.
A implementação concreta (`jwt-token.service.ts`) usa `jsonwebtoken` com secrets do `.env`.

```typescript
// AuthTokenPayload — claims mínimos (Princípio do Menor Privilégio)
interface AuthTokenPayload {
  sub: string;          // user id
  accountId: string;    // o tenant — ÚNICA fonte de escopo; nunca vem de body/query/header
  roleId: string;
  permissions: string[];
  modules: string[];    // plano ∩ conta (F2) — ver Requisitos/ADR-0001_Modulos_no_JWT.md
}
```

### Guards

| Guard | Local | Regra |
|---|---|---|
| `JwtAuthGuard` | `infrastructure/security/guards/jwt-auth.guard.ts` | Exige Bearer token válido; popula `request.user` **e estabelece o escopo do tenant** |
| `PermissionGuard` | `infrastructure/security/guards/permission.guard.ts` | `JwtAuthGuard` + as permissões de `@RequirePermission` |
| `ModuleGuard` (F2) | `infrastructure/security/guards/module.guard.ts` | `JwtAuthGuard` + o módulo de `@RequireModule` |

```typescript
@Controller('companies')
@UseGuards(PermissionGuard)              // protege todos os métodos
export class CompanyController {
  @Get()
  @RequirePermission(PERMISSIONS.companies.read)
  async list(): Promise<CompanyResponseDto[]> { /* ... */ }
}

@Controller('orders')
@UseGuards(ModuleGuard, PermissionGuard) // módulo primeiro: "módulo inativo" é mais acionável
@RequireModule(MODULES.VND)              // no controller — um controller pertence a um módulo
export class OrderController {
  @Post()
  @RequirePermission(PERMISSIONS.orders.create)  // no método — permissão é por operação
  async create(@Body() dto: CreateOrderRequestDto, @CurrentUser() user: AuthTokenPayload) { /* ... */ }
}
```

### Acessando o usuário autenticado

`request.user` é populado pelo `JwtAuthGuard`, que na mesma passagem estabelece o escopo do tenant.
Leia o `accountId` do payload — **nunca** de body/query/header. É por isso que nenhum request DTO
deste sistema tem um campo `accountId`:

```typescript
@Get()
@RequirePermission(PERMISSIONS.companies.read)
async list(@CurrentUser() user: AuthTokenPayload): Promise<CompanyResponseDto[]> {
  // user.accountId vem do token assinado, e de nenhum outro lugar
  return this.listCompaniesUseCase.execute(new ListCompaniesQuery(user.accountId));
}
```

### Recuperação de Senha por Código no WhatsApp

**Padrão da casa para todo sistema novo** (implementado no Plano Diário e no Batuta): a
recuperação de senha é um **código de 6 dígitos enviado no WhatsApp** pela Evolution API, não um
link por e-mail. O motivo é prático — o usuário lê o WhatsApp em segundos, e-mail de sistema cai em
spam — e é o que torna o WhatsApp obrigatório no cadastro (regra 9).

O envio usa o **card padrão** do Evolution: `POST /message/sendText/{instância}` com
`{ number, text }` e a **apikey da instância** no header (nunca a chave global — enviar mensagem
não precisa de poder para criar ou apagar instância).

```typescript
// Texto curto e SEM LINK de propósito: código acompanhado de link é o formato que golpista imita.
private buildText(message: PasswordResetMessage): string {
  return [
    `Olá, ${message.name}!`,
    '',
    `Seu código para redefinir a senha do ${APP_NAME} é *${message.code}*.`,
    '',
    `O código vale por ${message.expiresInMinutes} minutos e só pode ser usado uma vez.`,
    'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
  ].join('\n');
}
```

**Regras do fluxo — todas obrigatórias:**

| Regra | Motivo |
|---|---|
| Código de 6 dígitos com `randomInt` do `node:crypto` | `Math.random()` é previsível e não serve para gerar segredo |
| Guardar **só o hash** (bcrypt) do código | Nem dump de banco nem log revelam o valor |
| TTL curto (15 min) e **uso único** | O canal é instantâneo; não há motivo para valer uma hora |
| **Máximo de 5 tentativas** por código, contadas **antes** de recusar | Transforma 1.000.000 de combinações em 5 chances |
| Um só código vivo por usuário (pedir novo invalida o anterior) | Dois códigos válidos dobram a superfície de adivinhação |
| Limite de solicitações por hora, contando **envios** e não tentativas | O WhatsApp do usuário não pode virar canal de spam. Contar tentativa faria falha de infraestrutura consumir a cota |
| O canal é verificado **antes** de olhar o usuário | Se o erro só aparecesse no envio, e-mail real falharia e e-mail inexistente responderia 204 — entregando quais contas existem |
| Toda recusa levanta a **mesma** exceção e todo pedido responde igual | Sem oráculo de enumeração de contas |
| Instância **de sistema**, nunca um número de cliente/tenant | Chip de campanha cai; canal de recuperação não pode cair com ele |
| O código **jamais** entra em log — nem em erro | CLAUDE.md, regra de logs |

```env
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_SYSTEM_INSTANCE=    # instância de sistema (avisos da plataforma)
EVOLUTION_SYSTEM_APIKEY=      # apikey DA INSTÂNCIA — menor privilégio
```

### Variáveis de Ambiente (Auth)

```env
JWT_ACCESS_SECRET=<segredo-forte-aleatório>
JWT_REFRESH_SECRET=<outro-segredo-forte-aleatório>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# SMTP (reset de senha / notificações)
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=no-reply@<dominio>
```

## Shared Packages

> ⚠️ **São CÓPIAS, não código compartilhado.** Vieram do monorepo `project_structure` na extração
> de 10/08/2026. Corrigir algo aqui **não chega** ao Batuta/Ecoa/Kaza Tem, e corrigir lá não chega
> aqui — sem build quebrado, teste falhando ou aviso de lint. A divergência é silenciosa por
> construção. Decisão, motivo e o que fazer ao alterar um desses arquivos:
> `Requisitos/ADR-0002_Pacotes_Copiados.md`.

### @veertex/domain-primitives
Base classes para DDD: `AggregateRoot`, `Entity`, `ValueObject`, `DomainEvent`, `DomainException`.
Framework-agnostic (TypeScript puro).

> **`DomainException` recebe APENAS 1 argumento** (`super(message)`) — nunca 2.

### @veertex/shared-kernel
Tipos e utilitários comuns: `Result<T>`, `PaginatedResult<T>`, `PaginationParams`,
`UseCase<TCommand, TResult>`, `IRepository<T>`, `DateUtil`, `ValidationUtil`
(`isValidEmail`, `isValidCPF`).

### Package References (path aliases)
- `@veertex/domain-primitives` → `packages/domain-primitives/src`
- `@veertex/shared-kernel` → `packages/shared-kernel/src`

Dentro do backend:
- `@domain/*` → `src/contexts/*/domain/*`
- `@application/*` → `src/contexts/*/application/*`
- `@infrastructure/*` → `src/infrastructure/*`

**Importante:** packages têm ZERO dependências das apps e são framework-agnostic.

## MikroORM & PostgreSQL Specifics

- Config: `backend/mikro-orm.config.ts` (CLI, usuário OWNER) e
  `src/infrastructure/persistence/mikro-orm/config/` (aplicação, usuário de RUNTIME)
- **DUAS connection strings, e não é opcional:** `DATABASE_URL` (`veertex_app`, sem DDL, sujeito ao
  RLS) e `DATABASE_URL_MIGRATIONS` (`veertex_owner`, dono do schema). Apontar as duas para o mesmo
  usuário faz o RLS parar de valer para a aplicação — o dono ignora as policies
- ORM entities devem ter o sufixo `-orm.entity.ts`
- Migrations em `src/infrastructure/persistence/mikro-orm/migrations/`
- Seeders em `src/infrastructure/persistence/mikro-orm/seeders/`

### Padrão de persistência

```typescript
// ✅ Repositório injeta o EntityManager para persistir
@Injectable()
export class MikroOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: EntityRepository<UserOrmEntity>,
    private readonly em: EntityManager,   // necessário para persistAndFlush
    private readonly mapper: UserMapper,
  ) {}

  async save(user: User): Promise<User> {
    const orm = this.mapper.toOrm(user);
    await this.em.persistAndFlush(orm);   // ✅ no EntityManager, NUNCA no repo
    return this.mapper.toDomain(orm);
  }
}
```

### Storage — MinIO (uploads)

- O upload usa **base64 em JSON** (Fastify) — **não** usar `multer`/multipart do Express.
  Endpoints de upload recebem `fileBase64: string`, `fileName: string`, `fileMimeType: string`.
- O bucket e a chave do objeto ficam na entidade (ex.: `companies.logo_object_key`); a URL nunca é
  persistida — é montada na leitura, para que trocar de endpoint não exija migrar dados.

> ⚠️ **Ainda não implementado.** Nenhum endpoint de upload existe na F1. Este bloco registra o
> padrão para quando o primeiro entrar (logo da empresa, imagens de produto, evidências de rota).

### Queries SQL diretas (métricas/admin)

Quando precisar de SQL bruto (ex.: métricas administrativas), use
`em.getKnex().raw(...)` com placeholders `?` (queries parametrizadas — nunca concatenar string).

### Variáveis de Ambiente (Banco / Storage)

```env
# Usuário de RUNTIME: sem DDL, sem DELETE/TRUNCATE, sujeito ao RLS.
DATABASE_URL=postgresql://veertex_app:<senha>@<host>:5432/veertex
# Dono do schema: migrations e CLIs de operador. NUNCA para servir tráfego.
DATABASE_URL_MIGRATIONS=postgresql://veertex_owner:<senha>@<host>:5432/veertex

# MinIO (quando o primeiro upload entrar)
MINIO_ENDPOINT=
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=true
```

> A lista completa e atual vive em `backend/.env.example`, que é o único arquivo de ambiente
> versionado. Variável nova sem entrada lá é violação da regra 5.

## CORS Configuration

Configurado em `src/main.ts` via variável `CORS_ORIGIN`:

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});
```

**Regras:**
- Em produção, `CORS_ORIGIN` deve listar as origens reais do frontend (nunca `*` com credenciais)
- Em desenvolvimento, a origem típica é `http://localhost:3021` (frontend Next.js)

```env
# Desenvolvimento
CORS_ORIGIN=http://localhost:3021
# Produção (exemplo)
CORS_ORIGIN=https://app.<dominio>,https://<dominio>
```

## Error Reporting — Port de Monitoramento (preparação para um Guard próprio)

> Haverá uma ferramenta **própria** de captura/monitoramento de cenários de erro, o
> **`VEXGuard`** (ainda **não existe** — será desenvolvido por nós). **É uma ferramenta
> própria, sem qualquer vínculo com terceiros.** Todo sistema deve **já nascer preparado**
> para plugá-la, sem refatoração futura.

A preparação é arquitetural: um **port** de error-reporting (fire-and-forget) com um
**adapter no-op** registrado por padrão. Quando o `VEXGuard` existir, troca-se a
implementação do provider — **nada mais muda**.

### 1. Port (Application/Infra boundary)

```typescript
// src/infrastructure/observability/ports/error-reporter.port.ts
export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorScenario {
  exceptionType: string;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  context?: Record<string, unknown>; // já sanitizado (sem dados sensíveis)
  occurredAt: string;
}

export interface ErrorReporterPort {
  // Fire-and-forget: NUNCA lança, NUNCA bloqueia a resposta ao cliente.
  report(scenario: ErrorScenario): void;
}
```

### 2. Adapter no-op (default — registrado já)

```typescript
// src/infrastructure/observability/noop-error-reporter.ts
@Injectable()
export class NoopErrorReporter implements ErrorReporterPort {
  report(_scenario: ErrorScenario): void {
    // Sem ferramenta configurada → não faz nada. Não é erro.
  }
}

// PersistenceModule/AppModule (global)
providers: [{ provide: ERROR_REPORTER, useClass: NoopErrorReporter }],
exports: [ERROR_REPORTER],
```

### 3. Disparo no ponto único (GlobalExceptionFilter)

O `GlobalExceptionFilter` é o lugar de captura — cobertura total e automática.
**Só reporta erro real (500 / exceção inesperada)** — nunca 4xx esperado
(`DomainException` → 400, `HttpException` 401/403/404, validação).

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(ERROR_REPORTER) private readonly reporter: ErrorReporterPort) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // ... DomainException → 400, HttpException → status (NÃO reporta) ...

    // Qualquer outro erro → 500 genérico + reporta o cenário (fire-and-forget)
    this.reporter.report({
      exceptionType: (exception as Error)?.name ?? 'UnknownError',
      message: (exception as Error)?.message ?? 'unknown',
      stack: (exception as Error)?.stack,
      method: request.method,
      path: request.url,
      occurredAt: new Date().toISOString(),
    });
    response.status(500).send({ message: 'Erro interno. Tente novamente.' });
  }
}
```

### Regras do reporter (quando o `VEXGuard` for implementado)

- **Fire-and-forget**: o disparo roda fora do caminho da resposta (não bloqueia, não
  adiciona latência) e está dentro do próprio `try/catch` — uma falha de monitoramento
  **jamais** gera uma segunda exceção que mascare a original.
- **Sanitização na origem**: o `context` nunca contém senha, token, CPF, dados de pagamento.
- **O que reporta**: apenas 500 / exceções inesperadas. **Não** reporta 4xx esperado
  (negócio, validação, not found, forbidden).
- **Entrega por API key própria** (`ERROR_REPORTER_API_KEY`), nunca o JWT do usuário.
- Variáveis genéricas (adicionar ao `.env.example` quando implementar):
  ```env
  ERROR_REPORTER_URL=        # endpoint de ingestão do seu Guard (vazio = no-op)
  ERROR_REPORTER_API_KEY=    # secret de ingestão
  ```

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

## Integração WhatsApp (Evolution API)

Alguns sistemas (ex.: EMDR Remoto) enviam o link da sessão ao paciente por **WhatsApp** via
**Evolution API** (self-hosted em `https://evo2.techbs.com.br`). A integração é um **adapter de
saída** (`EvolutionGatewayPort` → `EvolutionGateway`) na infraestrutura; a aplicação nunca fala
com o Evolution direto.

**Dois tipos de chave (nunca confundir):**
- **Chave GLOBAL** (`AUTHENTICATION_API_KEY` do servidor Evolution — a mesma do Evolution
  Manager). Autoriza operações administrativas: **criar/deletar instâncias**. Vai na env
  **`EVOLUTION_API_KEY`**. Necessária só para o modo "instância própria" (psicólogo pareia o
  próprio número por QR).
- **Chave POR INSTÂNCIA** (o token de uma instância específica, ex.: a `emdr`). Autoriza só
  aquela instância: **enviar mensagem**, QR, status. Vai na env **`EVOLUTION_SHARED_APIKEY`**.

**Regra de segurança (inegociável):** os **valores** dessas chaves ficam **apenas** no `.env`
do backend (ou na UI do Dokploy em produção) — **nunca** neste CLAUDE.md, no código, no
frontend, nem em qualquer arquivo versionado. A chave global é mestra (controle total do
Evolution); se vazar, **rotacionar** no servidor. O frontend jamais recebe qualquer chave do
Evolution.

**Endpoints Evolution v2 usados:** `POST /instance/create` (global), `GET /instance/connect/{name}`
e `/instance/connectionState/{name}` (chave da instância), `POST /message/sendText/{name}`
(chave da instância), `DELETE /instance/logout|delete/{name}`.

**Variáveis de ambiente (adicionar ao `.env.example`; valores só no `.env`/Dokploy):**
```env
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_API_KEY=          # chave GLOBAL (AUTHENTICATION_API_KEY) — só p/ criar instância própria
EVOLUTION_SHARED_INSTANCE=  # nome da instância compartilhada (ex.: emdr)
EVOLUTION_SHARED_APIKEY=    # apikey da instância compartilhada
APP_PUBLIC_URL=             # domínio público do frontend (https://) — p/ o link ficar clicável no WhatsApp
```

> **Nota sobre links no WhatsApp:** o WhatsApp só transforma URLs com **domínio real** em link
> clicável — `http://localhost` fica como texto puro. Por isso os links de convite usam
> `APP_PUBLIC_URL` (domínio de produção); em dev use o deploy ou um túnel.

## Regras aprendidas com defeito real

**Estas três não vieram de requisito — vieram de coisas que quebraram.** Cada uma custou tempo, e
cada uma volta a custar se for esquecida. Valem para todo código deste repositório.

### 1. Adapter de teste nunca é fallback de produção — e nunca divirja do de produção

O adapter determinístico (`DeterministicIntentParser`,
`DeterministicPermissionPhraseTranslator`) existe para a suíte rodar sem chamada externa paga e não
determinística. Duas obrigações:

- **Nunca é fallback.** Se a chave do provedor falta, o adapter real **recusa**; ele não delega para
  o determinístico. Cair para o determinístico em produção devolveria comando enlatado por
  palavra-chave chamando-o de "tradução" — o operador aprovaria uma ação que o texto dele não pedia,
  e a procedência mentiria dizendo "ditado". Falhar fechado custa uma mensagem de erro; falhar aberto
  custa uma escrita errada aprovada por um humano que confiou na tela.
- **Nunca é mais permissivo nem mais estrito que o de produção.** Medido em 13/08/2026: o Gemini
  classificava as quatro frases interrogativas corretamente e o determinístico transformava todas em
  `SetRolePermissions` — quem perguntava "quem pode dar desconto" recebia rascunho de ALTERAÇÃO de
  papel. E é o determinístico que a suíte usa, então ele mentia sobre o comportamento de produção.
  Correção: a decisão que os dois compartilham vira **uma função só no domínio**
  (`looksLikeQuestion`), e a divergência deixa de ser possível por construção.

### 2. Guarda segura demais rebaixa o óbvio, e recurso abandonado protege zero

Também de 13/08/2026, no tradutor de frase → permissões. A guarda anti-invenção exigia que a citação
do modelo fosse **literal** na frase. Para *"pode ver e cadastrar empresas, mas não pode excluir
empresa"*, o modelo devolveu `companies.read → granted` citando «pode ver empresas» — correto em
sentido, não contíguo, porque elidiu o "e cadastrar". A guarda rebaixou para "a decidir".

Isso é **seguro e errado**: obrigava o operador a decidir à mão uma permissão que a frase concedia em
letras. Um recurso que devolve "não sei" para o que foi dito com clareza é um recurso que se aprende
a não usar — e recurso abandonado protege zero. A rigidez que parece prudência vira, na prática, a
remoção da própria proteção, porque o usuário volta para o caminho sem guarda nenhuma.

A correção não afrouxou a proteção, **mudou o eixo dela**: de "literal" para "ancorado" — as palavras
precisam aparecer na mesma linha e na mesma ordem, e a tela exibe a linha do usuário. A ordem é o que
impede o modelo de inverter concessão em negação.

> Ao escrever uma guarda contra alucinação, pergunte as duas coisas: *o que ela impede de passar?* e
> *o que ela derruba que devia passar?* Só a primeira pergunta produz guarda que ninguém usa.

### 3. Teste que falha por motivo alheio ensina a ignorar vermelho

É o que mais custou até aqui. Duas suítes medem **tempo real** e falham em máquina compartilhada,
sem que nada esteja errado no código:

- `test/integration/login-throttle.spec.ts` — mede o atraso progressivo comparando medições
  adjacentes;
- qualquer spec que use `runCli` — o CLI sobe o Nest inteiro via `ts-node`, e o teto de 30s do Jest
  estoura sob carga.

Em 13/08/2026 a mesma árvore deu **14 falhas, depois 4, depois 0** — a diferença era um build de
frontend e dois dev servers concorrendo por CPU. Rodadas sozinhas: 17/17.

**A regra:** antes de investigar uma falha dessas duas suítes, rode-as **sozinhas**. Se passarem, o
vermelho era da máquina. E não normalize isso: um vermelho que às vezes não significa nada treina a
não olhar o vermelho que significa. Alargar tolerância **não** é a correção — esconderia o defeito
oposto (o atraso que parou de acontecer). Ver o ADR-0003.

**O limite, e ele é a parte que impede a regra de se virar contra si mesma** (Eliab, 14/08/2026):
**"era da máquina" vale duas vezes. Na terceira, a suíte deixa de ser da máquina e vira defeito a
corrigir** — e a correção entra na frente do que estiver na fila.

Sem esse teto, a explicação que existe para *proteger* contra ignorar vermelho passa a ser a
*justificativa* para ignorá-lo: basta repeti-la. Uma explicação verdadeira e ilimitada é
indistinguível de uma desculpa — as duas produzem exatamente o mesmo comportamento, que é seguir sem
olhar. Três é o ponto em que a hipótese "ambiente" deixa de ser a mais simples: uma suíte que falha
com essa frequência está frágil por construção, e a fragilidade é o defeito.

Contar de verdade, e não de memória: registre no adendo do ADR-0003 cada vez que a frase for usada,
com data e suíte. Contagem que vive na cabeça de alguém reinicia sozinha em cada sessão — e três
vezes esquecidas são três vezes que não aconteceram.

## Testing Strategy

- **Unit tests** (`test/unit/`): Domain entities, value objects, use cases (mock repositories)
- **Integration tests** (`test/integration/`): Repository implementations, database interactions
- **E2E tests** (`test/e2e/`): Full HTTP request/response cycles

Padrões:
- **Arrange-Act-Assert**; nomes descritivos; mock de dependências externas
- Resetar mocks em `beforeEach`; testar edge cases (null/empty/boundary)
- Cobertura alvo: > 80% nas camadas domain e application

Run specific test: `npm run test -- path/to/file.spec.ts`

## Development Best Practices (Backend)

### Controller Guidelines

**NEVER:**
- Open direct database connections / manual SQL (always use ORM with mapped entities)
- Have multiple `catch` blocks in a single method
- Return body for DELETE (use 204 No Content)
- Put business logic in controllers (belongs in domain/use cases)

**ALWAYS:**
- Exactly ONE `try-catch` per controller method (when needed)
- Constructor injection for dependencies
- Mappers / Response DTOs for DTO ↔ Domain conversion
- Delegate complex logic to Use Cases

### Controller Seguro (template)

```typescript
@Controller('items')
@UseGuards(JwtAuthGuard) // guard no nível do controller — protege todos os métodos
export class ItemController {
  private readonly logger = new Logger(ItemController.name);

  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly getItemUseCase: GetItemUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateItemRequestDto,        // validado pelo ValidationPipe
    @Req() req,
  ): Promise<ItemResponseDto> {
    const user = req.user as AuthTokenPayload;
    try {
      return await this.createItemUseCase.execute({ ...dto, createdBy: user.sub });
    } catch (error) {
      this.logger.error('Erro ao criar item', { error, userId: user.sub });
      throw error; // tratado pelo exception filter do Nest / GlobalExceptionFilter
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteItemUseCase.execute({ id });
  }
}
```

### HTTP Status Code Standards

- **200 OK**: GET/PUT com conteúdo
- **201 Created**: POST com sucesso
- **204 No Content**: DELETE com sucesso (sem body)
- **400 Bad Request**: validação falhou ou violação de regra de negócio
- **401 Unauthorized**: autenticação falhou
- **403 Forbidden**: sem permissão (role incorreta)
- **404 Not Found**: recurso não encontrado
- **500 Internal Server Error**: exceção não tratada

### Service Layer / Transações

- Transações gerenciadas em **Use Cases**, nunca em Controllers
- Usar `UnitOfWorkPort` — nunca injetar `EntityManager` no use case
- Domain events publicados **após** a persistência bem-sucedida
- `throw` propaga o erro e dispara o rollback

### O que NÃO logar vs. O que logar

```typescript
// ❌ NUNCA logar dados sensíveis
this.logger.log(`Autenticando: cpf=${cpf} senha=${password}`);
this.logger.log(`Token: ${authToken}`);

// ✅ Logar contexto útil sem dados sensíveis
this.logger.log('Tentativa de autenticação', { userId });
this.logger.error('Falha na autenticação', { userId, reason: 'invalid_password' });
```

## Common Pitfalls to Avoid

1. ❌ Adicionar decorators MikroORM em domain entities → mantenha domain puro
2. ❌ Injetar `EntityManager` em use cases → use `UnitOfWorkPort`
3. ❌ Chamar `repository.persistAndFlush()` → `EntityRepository` não tem esse método; use `em.persistAndFlush()`
4. ❌ Lógica de negócio em controllers → vai para domain/use cases
5. ❌ Expor domain entities via HTTP → use Response DTOs
6. ❌ Pular mappers entre Domain ↔ ORM ↔ HTTP DTOs
7. ❌ Esquecer de publicar domain events após persistência
8. ❌ Usar string tokens para DI → use Symbols
9. ❌ Usar `multer`/multipart com Fastify → uploads em base64 JSON
10. ❌ Passar 2 argumentos para `DomainException` → recebe apenas `super(message)`
11. ❌ Paths relativos errados de use-cases para domain (são **3 níveis**: `../../../domain/`)
12. ❌ Introduzir qualquer dependência ligada a provedores de identidade externos

---

# Frontend Development Guidelines (Next.js 14 + MUI)

O frontend é um app **Next.js 14 (App Router)** com **Material-UI**. Roda na porta 3021.

## 1. Estrutura

- Páginas/rotas em `src/app/` (App Router). Hoje: `login/`, `forgot-password/`,
  `reset-password/` e o grupo autenticado `(app)/`. As telas de cadastro e as de módulo
  entram com as fatias correspondentes.
- Componentes gerais em `src/components/{ComponentName}/`
- Serviços HTTP por recurso: `src/services/{resource}Service.ts`
- Cliente axios em `src/services/api.ts` — **sempre com interceptor de token JWT**

### `src/services/api.ts` — interceptor JWT obrigatório

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3020/api',
});

// Injeta o access token em todas as requisições
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('veertex_access_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### Service Pattern

```typescript
import api from 'src/services/api';

async function getAll(params: { filter?: string; page?: number; limit?: number }) {
  const response = await api.get('/products', { params });
  return response.data; // { items, total, page, totalPages }
}

async function create(item: CreateProductDto) {
  const response = await api.post('/admin/products', item);
  return response.data;
}

const productService = { getAll, create };
export default productService;
```

## 2. Coding Standards

- **Componentes**: `export function MyPage() {}` — nunca arrow + `export default`
- **Funções**: `function` para declarações; `const` só para hooks/variáveis
- **Exports**: nomeados; `export default` apenas em módulos de service
- **TypeScript**: evitar `any`; tipos reutilizáveis em `src/types/{entity}.ts`;
  nunca declarar tipos dentro de funções
- **Imports**: usar paths a partir de `src/` — nunca `../../../`
- **Client vs Server Components**: marque com `'use client'` componentes que usam estado,
  efeitos, ou acessam `localStorage`/`window`

## 3. HTML Semântico (obrigatório)

Usar `<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<aside>`, `<footer>`.
Acessibilidade: `role="status"` para loading, `role="alert"` para erros, `aria-label` em seções.

## 4. Styling

- **Material-UI** para todos os elementos de UI; Material-UI Icons para ícones
- Estilos complexos em `styles.ts` (styled-components / `@mui/material/styles`)
- **Nunca** inline styles nem cores hardcoded (RGB/hex) — usar `theme.palette`
- Um styled component por elemento visual; mapear elementos semânticos

## 5. Forms

- **react-hook-form** + **yup** (resolver `@hookform/resolvers/yup`)
- `react-imask` para máscaras (CPF, telefone, etc.)

```typescript
const validationSchema = yup.object({
  cpf: yup.string().required('CPF obrigatório'),
  password: yup.string().min(6, 'Mínimo 6 caracteres').required('Senha obrigatória'),
});
```

## 6. Notificações ao usuário

Usar **notistack** (`useSnackbar`) para feedback:

```typescript
const { enqueueSnackbar } = useSnackbar();
enqueueSnackbar('Operação realizada com sucesso', { variant: 'success' });
enqueueSnackbar(error?.response?.data?.message || 'Erro ao processar', { variant: 'error' });
```

## 7. Environment Variables (Frontend)

- Variáveis expostas ao browser **devem** ter prefixo `NEXT_PUBLIC_`
- Secrets (senha de banco, apikey do Evolution, chaves do MinIO) **nunca** vão para o frontend
- Nunca commitar `.env.local`/`.env.production`

```env
NEXT_PUBLIC_API_URL=http://localhost:3020/api
```

## 8. Naming Conventions

- **Código e comentários**: inglês
- **Labels e mensagens de UI**: português
- **Arquivos**: camelCase para utils, PascalCase para componentes
- **Variáveis**: camelCase · **Componentes**: PascalCase · **Constantes**: UPPER_SNAKE_CASE

## 9. State Management

- React Context API para estado global (ex: carrinho, usuário autenticado)
- Custom hooks para consumir contexts (`useAuth`, `useCart`)

## Key Files to Reference

**Auth (próprio):**
- `backend/src/contexts/auth/` — login, refresh, reset de senha
- `backend/src/infrastructure/security/guards/` — JwtAuthGuard, PermissionGuard, ModuleGuard (F2)
- `backend/src/infrastructure/security/jwt-token.service.ts`

**Domain/Application/Infra (exemplos):**
- Domain: `backend/src/contexts/company/domain/entities/company.entity.ts`
- Use case: `src/contexts/<context>/application/use-cases/<name>/<name>.use-case.ts`
- Repository: `src/infrastructure/persistence/mikro-orm/repositories/`
- Mapper: `src/infrastructure/persistence/mikro-orm/mappers/`
- Controller: `src/infrastructure/http/controllers/`

**Configuração:**
- App module: `src/app.module.ts`
- Bootstrap: `src/main.ts`
- MikroORM: `mikro-orm.config.ts`

**Shared packages:**
- `packages/domain-primitives/src/` · `packages/shared-kernel/src/`

**Documentação de entregas/pendências:**
- `docs/modulos/` — planos de entrega e análises de pendências

---

# Deploy no Servidor mdantas (Dokploy) — Playbook

> **Gatilho:** quando o Eliab disser **"quero subir no mdantas"** (ou "deploy no mdantas"),
> seguir este playbook. Primeiro definir **qual projeto** e **qual domínio**, depois executar.
> Este processo foi validado no deploy do **Ecoa** (jul/2026).

## Infra fixa do servidor mdantas

| Item | Valor |
|---|---|
| Plataforma | **Dokploy** em `https://dokploy.mdantas.com.br` (conta `eliab@techbs.com.br`) |
| Reverse proxy / HTTPS | **Traefik + Let's Encrypt** (automático, gerenciado pelo Dokploy) |
| **IP público do servidor** | **`72.61.43.90`** |
| DNS | **Cloudflare** (conta `hostmaster@mdantas.com.br`) |
| Git dos apps | **GitLab** (`git@gitlab.com:eliab1/<projeto>.git`), via provedor **Git + Deploy Key** |

### Projetos existentes no Dokploy (cada cliente = um "project")

| Project (Dokploy) | Domínio principal (Cloudflare) | Observação |
|---|---|---|
| `psi` | **`equipamentospsi.com`** | Cliente PSI Equipamentos — onde vive o **Ecoa** (`ecoa.equipamentospsi.com`) + site WordPress |
| `techbs` | `techbs.com.br` | |
| `emdrremoto` | `emdrremoto.com.br` | |
| `kazatemimports` | — | |

> Ao subir um app novo, **perguntar em qual project** ele entra (ou criar um novo) e **qual subdomínio**.

## Pré-requisitos do repositório (antes de tocar no Dokploy)

O Dokploy builda a partir de um **repo Git** com **Dockerfile**. Neste repositório (workspaces + pacotes compartilhados):

1. **Repo no GitLab** (`eliab1/<projeto>`), branch `main`.
2. **Dockerfiles cientes dos workspaces** (contexto = raiz do repo): copiam `package.json`+`package-lock.json`, os `packages/`, e o app; buildam os pacotes (`tsc`) e o app.
   - **Base `node:22-alpine`** (o `@supabase/*` exige node ≥ 22).
   - Backend NestJS: `node dist/main` (usa imports relativos → não precisa tsconfig-paths).
   - Frontend Next.js: `next start`; **API base relativa `/api`** por padrão no `services/api.ts` (domínio único).
3. **`package-lock.json` versionado** (NÃO gitignorar) — `npm ci` exige.
4. **`.dockerignore`** na raiz (exclui `node_modules`, `dist`, `.next`, `.env`).
5. **Nunca commitar segredos**: `.env`/`.env.local` no `.gitignore`; segredos só na **UI do Dokploy**.
6. **Deploy Key**: cadastrar a **chave pública** da SSH Key do Dokploy em **GitLab → projeto → Settings → Repository → Deploy keys** (read-only). Não usar a integração OAuth do GitLab (dá "Failed to refresh token").

## Passo a passo no Dokploy

Estrutura padrão = **3 serviços** por app: **Redis (Database)** + **Backend (Application)** + **Frontend (Application)**.

### 1. Redis (se o app usar filas/BullMQ)
`Create Service → Database → Redis`. Depois, na página do serviço, pegar os **dados de conexão INTERNOS**:
- **Internal Host** (ex.: `psi-ecoaredis-aaa5mv`) — **NÃO** é o nome amigável; é o host gerado.
- **Internal Port** `6379`, **User** `default`, **Password** (copiar).
- Garantir que está **Running** (Deploy/Start).

### 2. Backend (Application)
- **Provider = Git** · URL `git@gitlab.com:eliab1/<projeto>.git` · Branch `main` · SSH Key do Dokploy (Deploy Key no GitLab).
- **Build Type = Dockerfile** · Docker File `backend/Dockerfile` · **Docker Context Path = `/`** (⚠️ raiz do repo — sem isso o `COPY` falha com "not found").
- **Domains → Add**: Host `<sub>.<dominio>` · **Path `/api`** · **Strip Path OFF** (o backend usa `setGlobalPrefix('api')`) · **Container Port** (a real do app, ex. 3005) · **HTTPS ON** (Let's Encrypt).
- **Environment** (na UI): todas as variáveis (ver abaixo).

### 3. Frontend (Application)
- Mesmo Provider Git + Deploy Key.
- **Build Type = Dockerfile** · Docker File `frontend/Dockerfile` · **Docker Context Path = `/`**.
- **Domains → Add**: Host `<sub>.<dominio>` · **Path `/`** · **Container Port** 3021 · **HTTPS ON**.
- Com API relativa (`/api`) no mesmo domínio, **não precisa** `NEXT_PUBLIC_API_URL`. Se usar domínio separado p/ API, passar `NEXT_PUBLIC_API_URL` como **Build Arg** (é embutido no build).

### 4. DNS (Cloudflare)
No domínio do projeto → **DNS → Add record**:
- **Type A** · **Name** `<sub>` · **IPv4 `72.61.43.90`** · **Proxy status = DNS only (nuvem CINZA)** ⚠️
- Cinza é obrigatório: com "Proxied" (laranja) o Let's Encrypt do Dokploy **não emite** o certificado.
- Validar com **"Validate DNS"** no domínio do Dokploy (fica verde quando propaga).

### 5. Deploy
Aba **General → Deploy**. Acompanhar **Deployments** (build) e depois **Logs** (runtime).

## Variáveis de ambiente — regras (vão na UI do Dokploy, NÃO no arquivo)

- **O `.env`/`.env.production.example` são só referência local.** Produção lê da **aba Environment** do Dokploy.
- **Trocar TODO `<placeholder>`** por valor real (ex.: `<SENHA_REAL>`).
- `REDIS_HOST` = **Internal Host** do Redis do Dokploy (+ `REDIS_PASSWORD`, `REDIS_USERNAME=default`).
- Se o app compartilha banco/segredos com o ambiente local, **reusar os mesmos valores** (ex.: `IG_TOKEN_ENCRYPTION_KEY` idêntica, senão tokens criptografados não decriptam).
- Domínios (CORS, redirect, FRONTEND_URL) apontando para o **domínio público real**.
- Após alterar Environment: **Save + Redeploy** (env só entra em novo deploy).

## Lições aprendidas (erros que já resolvemos — checar sempre)

| Sintoma no log | Causa | Correção |
|---|---|---|
| `COPY ... "/xxx": not found` no build | Docker Context Path errado (pasta do Dockerfile) | **Docker Context Path = `/`** (raiz do repo) |
| `EBADENGINE ... @supabase ... required node >=22` | Imagem node 20 | Base **`node:22-alpine`** |
| `queryA ENOTFOUND <dominio>` no Validate DNS | Registro A não existe/propagou | Criar A → `72.61.43.90` (cinza) e revalidar |
| Let's Encrypt não emite cert | Cloudflare **Proxied (laranja)** | Deixar **DNS only (cinza)** |
| `EMAXCONNSESSION max clients ... pool_size: 15` | Pool do ORM > limite do Session Pooler | Limitar pool (ex. MikroORM `pool: {min:0,max:5}`) |
| `password authentication failed` | Senha errada no `DATABASE_URL`, ou caractere especial sem URL-encode | Conferir a senha; `@` vira `%40`, `#` vira `%23` |
| `getaddrinfo ENOTFOUND ecoa-redis` | `REDIS_HOST` com nome amigável | Usar o **Internal Host** real do Redis |
| Frontend chama `http://localhost:3020/api` | `NEXT_PUBLIC_API_URL` não embutido no build | API base relativa **`/api`** (mesmo domínio) + **Rebuild com Clean Cache** + `Ctrl+Shift+R` no navegador |
| Deploy Key / OAuth GitLab "Failed to refresh token" | Integração OAuth do Dokploy instável | Usar provedor **Git + Deploy Key** (chave pública no GitLab) |

## Meta/Instagram após deploy (se o app integra IG)
Atualizar no app da Meta para o **domínio público**:
- Facebook Login → **Valid OAuth Redirect URIs**: `https://<sub>.<dominio>/connection/callback`
- Webhook (`instagram`/`mentions`): `https://<sub>.<dominio>/api/webhooks/instagram` + verify token
- Detecções/menções e insights de terceiros só valem após **App Review + Business Verification** (ver spec do app).
