# System Example - Arquitetura Hexagonal com NestJS

Sistema de exemplo demonstrando a implementação completa de arquitetura hexagonal com NestJS, MikroORM e SQL Server.

## 🎯 Objetivo

Este sistema serve como referência para implementar novos bounded contexts e sistemas no monorepo, demonstrando:

- Arquitetura Hexagonal (Ports & Adapters)
- Domain-Driven Design (DDD)
- CQRS pattern (separação Command/Query)
- Domain Events
- Unit of Work
- Repository pattern
- Dependency Injection type-safe

## 🏗️ Estrutura

### Bounded Context: User

#### Domain Layer (`src/contexts/user/domain/`)
- **Entities**: `user.entity.ts` - Aggregate root com regras de negócio
- **Value Objects**: `user-id.vo.ts`, `email.vo.ts` - Objetos imutáveis
- **Events**: `user-created.event.ts`, `user-email-changed.event.ts`
- **Exceptions**: `user-already-exists.exception.ts`, `user-not-found.exception.ts`

#### Application Layer (`src/contexts/user/application/`)
- **Use Cases**:
  - `create-user/` - Criar novo usuário
  - `get-user/` - Buscar usuário por ID
- **Ports**:
  - `input/` - Interfaces de comandos
  - `output/` - Interfaces de repositórios
- **DTOs**: `user.dto.ts` - Data Transfer Objects

#### Infrastructure Layer (`src/infrastructure/`)
- **HTTP**: Controllers, Request/Response DTOs
- **Persistence**: MikroORM entities, repositories, mappers
- **Messaging**: Event publishers

## 🚀 Quick Start

### 1. Instalar dependências

```bash
# Da raiz do monorepo
npm install
```

### 2. Configurar ambiente

```bash
cd apps/system-example
cp .env.example .env
```

Edite o `.env` com suas configurações de SQL Server:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourStrongPassword123
DB_NAME=gitspread_example
DB_SYNC=false
DB_LOGGING=true
```

### 3. Criar database

```sql
CREATE DATABASE gitspread_example;
```

### 4. Rodar migrations

```bash
npm run migration:up
```

### 5. Iniciar aplicação

```bash
npm run dev
```

A aplicação estará rodando em `http://localhost:3000`

## 📡 API Endpoints

### POST /users
Criar novo usuário

**Request:**
```json
{
  "email": "john@example.com",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-06T10:00:00.000Z",
  "updatedAt": "2024-01-06T10:00:00.000Z",
  "isActive": true
}
```

### GET /users/:id
Buscar usuário por ID

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-06T10:00:00.000Z",
  "updatedAt": "2024-01-06T10:00:00.000Z",
  "isActive": true
}
```

## 🧪 Testando

### Teste com curl

```bash
# Criar usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Buscar usuário
curl http://localhost:3000/users/<USER_ID>
```

### Testes automatizados

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📝 Adicionando um Novo Use Case

### Exemplo: Update User Name

#### 1. Criar Command
```typescript
// src/contexts/user/application/use-cases/update-user-name/update-user-name.command.ts
export class UpdateUserNameCommand {
  constructor(
    public readonly userId: string,
    public readonly newName: string,
  ) {}
}
```

#### 2. Criar Use Case
```typescript
// src/contexts/user/application/use-cases/update-user-name/update-user-name.use-case.ts
@Injectable()
export class UpdateUserNameUseCase implements UseCase<UpdateUserNameCommand, UserDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateUserNameCommand): Promise<UserDto> {
    const userId = UserId.from(command.userId);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId.value);
    }

    user.changeName(command.newName);

    const savedUser = await this.unitOfWork.execute(async () => {
      return this.userRepository.save(user);
    });

    return UserDto.fromDomain(savedUser);
  }
}
```

#### 3. Adicionar ao Module
```typescript
// src/contexts/user/user.module.ts
@Module({
  providers: [
    // ... outros providers
    UpdateUserNameUseCase,
  ],
  exports: [
    // ... outros exports
    UpdateUserNameUseCase,
  ],
})
export class UserModule {}
```

#### 4. Criar Controller endpoint
```typescript
// src/infrastructure/http/controllers/user/user.controller.ts
@Patch(':id/name')
async updateName(
  @Param('id') id: string,
  @Body() dto: UpdateUserNameRequestDto,
): Promise<UserResponseDto> {
  const command = new UpdateUserNameCommand(id, dto.name);
  const userDto = await this.updateUserNameUseCase.execute(command);
  return UserResponseDto.fromDto(userDto);
}
```

## 🏛️ Padrões Arquiteturais Implementados

### 1. Dependency Inversion
- Application define interfaces (Ports)
- Infrastructure implementa as interfaces (Adapters)
- Use Symbols para DI type-safe

### 2. Domain Events
- Agregados emitem eventos de domínio
- Repositórios publicam eventos após persistência
- In-process com EventEmitter2 (pode adicionar RabbitMQ, etc)

### 3. Unit of Work
- Transações gerenciadas de forma transparente
- MikroORM EntityManager encapsulado
- Use cases não conhecem detalhes de transação

### 4. Repository Pattern
- Abstração de persistência via ports
- Mappers Domain ↔ ORM
- Domain entities puros (sem decorators)

### 5. CQRS (básico)
- Commands: `create-user.command.ts`
- Queries: `get-user.query.ts`
- Separação de responsabilidades

## 🔍 Estrutura de Pastas Detalhada

```
src/
├── contexts/user/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── user.entity.ts               # Aggregate Root
│   │   ├── value-objects/
│   │   │   ├── user-id.vo.ts                # Identity
│   │   │   └── email.vo.ts                  # Email VO
│   │   ├── events/
│   │   │   ├── user-created.event.ts
│   │   │   └── user-email-changed.event.ts
│   │   └── exceptions/
│   │       ├── user-already-exists.exception.ts
│   │       └── user-not-found.exception.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── create-user/
│   │   │   │   ├── create-user.command.ts
│   │   │   │   └── create-user.use-case.ts
│   │   │   └── get-user/
│   │   │       ├── get-user.query.ts
│   │   │       └── get-user.use-case.ts
│   │   ├── ports/
│   │   │   └── output/
│   │   │       └── user-repository.port.ts  # Interface
│   │   └── dto/
│   │       └── user.dto.ts
│   └── user.module.ts                       # DI Configuration
│
├── infrastructure/
│   ├── http/
│   │   ├── controllers/user/
│   │   │   ├── dto/
│   │   │   │   ├── create-user.request.dto.ts
│   │   │   │   └── user.response.dto.ts
│   │   │   └── user.controller.ts
│   │   └── http.module.ts
│   ├── persistence/
│   │   ├── mikro-orm/
│   │   │   ├── config/
│   │   │   │   └── mikro-orm.config.ts
│   │   │   ├── entities/
│   │   │   │   └── user-orm.entity.ts       # ORM Entity
│   │   │   ├── repositories/
│   │   │   │   └── user.repository.ts       # Implementation
│   │   │   ├── mappers/
│   │   │   │   └── user.mapper.ts           # Domain <-> ORM
│   │   │   ├── migrations/
│   │   │   └── unit-of-work.ts
│   │   ├── ports/
│   │   │   ├── unit-of-work.port.ts
│   │   │   └── event-publisher.port.ts
│   │   └── persistence.module.ts
│   └── messaging/
│       └── publishers/
│           └── domain-event.publisher.ts
│
├── config/
│   └── env.validation.ts
├── app.module.ts
└── main.ts
```

## 📚 Referências de Código

### Como usar Value Objects

```typescript
// Criar
const email = Email.create('user@example.com');
const userId = UserId.generate();
const existingId = UserId.from('550e8400-...');

// Acessar valor
console.log(email.value); // 'user@example.com'
console.log(userId.value); // '550e8400-...'

// Comparar
if (email1.equals(email2)) {
  // são iguais
}
```

### Como usar Entities

```typescript
// Criar (factory method)
const user = User.create(email, 'John Doe');

// Reconstituir (do banco)
const user = User.reconstitute(id, email, name, createdAt, updatedAt, isActive);

// Mudar estado
user.changeEmail(newEmail);
user.changeName('Jane Doe');
user.deactivate();

// Acessar propriedades
console.log(user.id.value);
console.log(user.email.value);
console.log(user.name);
```

### Como usar Domain Events

```typescript
// Adicionar evento (na entity)
this.addDomainEvent(new UserCreatedEvent(this._id.value, this._email.value));

// Pegar eventos (no repository)
const events = user.pullDomainEvents();
await this.eventPublisher.publishAll(events);

// Escutar evento
@Injectable()
export class UserCreatedHandler {
  @OnEvent('user.created')
  async handle(event: UserCreatedEvent): Promise<void> {
    // Enviar email de boas-vindas, etc
  }
}
```

## 🛠️ Próximos Passos

1. **Adicionar autenticação**
   - JWT strategy
   - Guards
   - Decorators customizados

2. **Implementar paginação**
   - Usar `PaginationParams` do shared-kernel
   - Adicionar use case `list-users`

3. **Health checks**
   - `@nestjs/terminus`
   - Endpoints `/health` e `/ready`

4. **Swagger/OpenAPI**
   - `@nestjs/swagger`
   - Documentação automática da API

5. **Logging estruturado**
   - Winston ou Pino
   - Request/response logging

6. **Monitoramento**
   - Prometheus metrics
   - APM (Application Performance Monitoring)

## 🤝 Contribuindo

Ao adicionar novas features, siga os padrões estabelecidos:

1. Domain deve ser puro (sem dependências)
2. Use Ports para definir contratos
3. Adapters implementam Ports
4. Use Symbols para DI
5. Separar ORM entities de Domain entities
6. Mappers para conversão
7. Eventos de domínio para side effects

---

**Para mais informações, veja o [README principal](../../README.md) do monorepo.**
