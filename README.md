# GitSpread - Monorepo com Arquitetura Hexagonal

Monorepo para desenvolvimento de múltiplos sistemas usando **Arquitetura Hexagonal** (Ports & Adapters) com NestJS, MikroORM e TypeScript.

## 📋 Tabela de Conteúdos

- [Tecnologias](#tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Arquitetura Hexagonal](#arquitetura-hexagonal)
- [Instalação](#instalação)
- [Desenvolvimento](#desenvolvimento)
- [Testes](#testes)
- [Padrões de Código](#padrões-de-código)

## 🚀 Tecnologias

### Core
- **Node.js** 20+
- **TypeScript** 5.3+
- **npm workspaces** (gerenciamento de monorepo)

### Backend Framework
- **NestJS** 10+ com Fastify adapter
- **@nestjs/config** - Configuração e validação de environment
- **@nestjs/event-emitter** - Event handling in-process

### Database & ORM
- **MikroORM** 6+ - ORM com pattern Unit of Work
- **SQL Server** - Database principal
- **Migrations** - Controle de schema

### Validação
- **class-validator** - Validação de DTOs
- **class-transformer** - Transformação de objetos

### Testes
- **Jest** - Framework de testes
- **ts-jest** - TypeScript support para Jest

### Code Quality
- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript strict mode** - Type safety

## 📁 Estrutura do Projeto

```
GitSpread/
├── packages/                       # Pacotes compartilhados
│   ├── domain-primitives/          # Base classes DDD
│   │   ├── src/
│   │   │   ├── aggregate-root.base.ts
│   │   │   ├── entity.base.ts
│   │   │   ├── value-object.base.ts
│   │   │   ├── domain-event.base.ts
│   │   │   └── domain-exception.base.ts
│   │   └── package.json
│   │
│   └── shared-kernel/              # Types, interfaces, utils
│       ├── src/
│       │   ├── types/
│       │   ├── interfaces/
│       │   └── utils/
│       └── package.json
│
└── apps/                           # Aplicações/Sistemas
    └── system-example/             # Sistema de exemplo
        ├── src/
        │   ├── contexts/           # Bounded Contexts
        │   │   └── user/
        │   │       ├── domain/              # Camada de Domínio
        │   │       │   ├── entities/
        │   │       │   ├── value-objects/
        │   │       │   ├── events/
        │   │       │   └── exceptions/
        │   │       ├── application/         # Camada de Aplicação
        │   │       │   ├── use-cases/
        │   │       │   ├── ports/
        │   │       │   │   ├── input/
        │   │       │   │   └── output/
        │   │       │   └── dto/
        │   │       └── user.module.ts
        │   │
        │   ├── infrastructure/              # Camada de Infraestrutura
        │   │   ├── http/
        │   │   │   ├── controllers/
        │   │   │   └── http.module.ts
        │   │   ├── persistence/
        │   │   │   ├── mikro-orm/
        │   │   │   │   ├── entities/
        │   │   │   │   ├── repositories/
        │   │   │   │   ├── mappers/
        │   │   │   │   └── config/
        │   │   │   ├── ports/
        │   │   │   └── persistence.module.ts
        │   │   └── messaging/
        │   │       └── publishers/
        │   │
        │   ├── config/
        │   ├── app.module.ts
        │   └── main.ts
        │
        └── package.json
```

## 🏛️ Arquitetura Hexagonal

A arquitetura hexagonal (Ports & Adapters) organiza o código em três camadas principais:

### 1. Domínio (Domain)
**Núcleo da aplicação - Regras de negócio puras**

- **Entities**: Objetos com identidade e ciclo de vida
- **Value Objects**: Objetos imutáveis sem identidade
- **Domain Events**: Eventos que ocorrem no domínio
- **Domain Services**: Lógica que não pertence a uma entidade específica
- **Exceptions**: Exceções de negócio

**Características:**
- ✅ Sem dependências de frameworks
- ✅ 100% testável sem infraestrutura
- ✅ Agnóstico de tecnologia

### 2. Aplicação (Application)
**Orquestração de casos de uso**

- **Use Cases**: Implementam regras de aplicação e orquestram o domínio
- **Ports**: Interfaces que definem contratos
  - **Input Ports**: Interfaces de entrada (comandos)
  - **Output Ports**: Interfaces de saída (repositórios, gateways)
- **DTOs**: Objetos de transferência de dados

**Características:**
- ✅ Coordena entities e services
- ✅ Define interfaces (ports)
- ✅ Não conhece detalhes de infraestrutura

### 3. Infraestrutura (Infrastructure)
**Adaptadores concretos**

- **HTTP Adapter**: Controllers, DTOs de request/response
- **Persistence Adapter**: Repositórios, Mappers, ORM entities
- **Messaging Adapter**: Event publishers, subscribers
- **CLI Adapter**: Comandos de console

**Características:**
- ✅ Implementa as portas definidas na aplicação
- ✅ Conecta com frameworks e tecnologias
- ✅ Facilmente substituível

### Fluxo de Dados

```
HTTP Request
    ↓
Controller (Infrastructure)
    ↓
Use Case (Application)
    ↓
Entity/Service (Domain)
    ↓
Repository Port (Application)
    ↓
Repository Implementation (Infrastructure)
    ↓
ORM/Database
```

### Benefícios

- **Testabilidade**: Domain e Application testáveis sem infraestrutura
- **Manutenibilidade**: Separação clara de responsabilidades
- **Flexibilidade**: Fácil trocar adapters (DB, HTTP framework, etc)
- **Escalabilidade**: Bounded contexts independentes
- **Type Safety**: TypeScript + Symbols para DI

## 📦 Instalação

### Pré-requisitos

- Node.js >= 20.0.0
- npm >= 10.0.0
- SQL Server (ou Docker com SQL Server)

### Setup

1. **Clone o repositório**
```bash
git clone <repository-url>
cd GitSpread
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cd apps/system-example
cp .env.example .env
# Edite o .env com suas configurações de banco de dados
```

4. **Execute as migrations**
```bash
cd apps/system-example
npm run migration:up
```

## 🔧 Desenvolvimento

### Comandos disponíveis (root)

```bash
# Build de todos os workspaces
npm run build

# Testes
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e

# Linting e formatação
npm run lint
npm run format

# Type checking
npm run typecheck
```

### Comandos do system-example

```bash
cd apps/system-example

# Desenvolvimento
npm run dev              # Roda com watch mode
npm run dev:debug        # Roda em modo debug

# Build e start
npm run build
npm run start
npm run start:prod

# Testes
npm run test
npm run test:watch
npm run test:cov

# Migrations
npm run migration:create   # Criar nova migration
npm run migration:up       # Rodar migrations
npm run migration:down     # Reverter migration

# Database
npm run schema:drop        # Drop do schema
npm run schema:fresh       # Drop + Migrations
npm run seed               # Rodar seeders
```

### Desenvolvendo uma nova feature

1. **Crie o bounded context** em `src/contexts/<nome>/`
2. **Domain Layer**: Entities, Value Objects, Events, Exceptions
3. **Application Layer**: Use Cases, Ports (interfaces), DTOs
4. **Infrastructure Layer**: Controllers, Repositories (implementações)
5. **Module**: Configure DI no `<nome>.module.ts`
6. **Importe** no `app.module.ts` e `http.module.ts`

## 🧪 Testes

### Estrutura de Testes

```
apps/system-example/
└── test/
    ├── unit/              # Testes unitários (domain, application)
    ├── integration/       # Testes de integração (repositories, use cases)
    └── e2e/               # Testes end-to-end (API)
```

### Rodando Testes

```bash
# Todos os testes
npm test

# Unit tests (domain/application)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

### Exemplo de Teste Unitário (Domain)

```typescript
// test/unit/contexts/user/domain/user.entity.spec.ts
describe('User Entity', () => {
  it('should create a user successfully', () => {
    const email = Email.create('test@example.com');
    const user = User.create(email, 'John Doe');

    expect(user.name).toBe('John Doe');
    expect(user.email).toBe(email);
    expect(user.isActive).toBe(true);
    expect(user.domainEvents).toHaveLength(1);
  });
});
```

## 📝 Padrões de Código

### Injeção de Dependência com Symbols

```typescript
// Define port symbol
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// Use no módulo
@Module({
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: MikroOrmUserRepository,
    },
  ],
})
export class UserModule {}

// Injete no use case
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}
}
```

### Separação Domain ↔ ORM

```typescript
// Domain Entity (puro, sem decorators)
export class User extends AggregateRoot {
  constructor(
    private readonly _id: UserId,
    private _email: Email,
    // ...
  ) {}
}

// ORM Entity (com decorators MikroORM)
@Entity({ tableName: 'users' })
export class UserOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string;
  // ...
}

// Mapper
export class UserMapper {
  toDomain(orm: UserOrmEntity): User { /* ... */ }
  toOrm(domain: User): UserOrmEntity { /* ... */ }
}
```

### Transações (Unit of Work)

```typescript
@Injectable()
export class CreateUserUseCase {
  async execute(command: CreateUserCommand): Promise<UserDto> {
    // Executar dentro de transação
    const savedUser = await this.unitOfWork.execute(async () => {
      return this.userRepository.save(user);
    });

    return UserDto.fromDomain(savedUser);
  }
}
```

### Domain Events

```typescript
// Entity adiciona eventos
export class User extends AggregateRoot {
  static create(email: Email, name: string): User {
    const user = new User(/* ... */);
    user.addDomainEvent(new UserCreatedEvent(/* ... */));
    return user;
  }
}

// Repository publica após persistir
async save(user: User): Promise<User> {
  await this.repository.persistAndFlush(ormEntity);

  const events = user.pullDomainEvents();
  await this.eventPublisher.publishAll(events);

  return this.mapper.toDomain(ormEntity);
}
```

## 🔄 Adicionando Novos Sistemas

Para adicionar um novo sistema ao monorepo:

1. Crie a estrutura em `apps/<novo-sistema>/`
2. Copie a estrutura de pastas do `system-example`
3. Configure `package.json`, `tsconfig.json`, `nest-cli.json`
4. Implemente seus bounded contexts
5. Configure módulos NestJS

## 📚 Recursos

- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS with Fastify](https://docs.nestjs.com/techniques/performance)
- [MikroORM Documentation](https://mikro-orm.io/)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

## 📄 Licença

MIT

## 👥 Contribuindo

1. Faça fork do projeto
2. Crie uma feature branch
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido com ❤️ usando Arquitetura Hexagonal**
