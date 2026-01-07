# Getting Started - GitSpread Monorepo

Guia rápido para começar a desenvolver no monorepo GitSpread com arquitetura hexagonal.

## ⚡ Quick Start (5 minutos)

### 1. Pré-requisitos

Certifique-se de ter instalado:
- Node.js >= 20.0.0
- npm >= 10.0.0
- SQL Server (ou Docker Desktop)

### 2. Clonar e Instalar

```bash
# Clone o repositório
cd GitSpread

# Instale as dependências de TODOS os workspaces
npm install
```

### 3. Setup SQL Server (com Docker)

Se não tiver SQL Server instalado, use Docker:

```bash
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong@Passw0rd" \
  -p 1433:1433 --name sql-server \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

### 4. Configurar Environment

```bash
cd apps/system-example
cp .env.example .env
```

Edite o `.env` se necessário:
```env
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd
DB_NAME=gitspread_example
```

### 5. Criar Database

```bash
# Conectar ao SQL Server e criar database
docker exec -it sql-server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong@Passw0rd" \
  -Q "CREATE DATABASE gitspread_example"
```

Ou use seu cliente SQL favorito (Azure Data Studio, SSMS, DBeaver, etc).

### 6. Rodar Migrations

```bash
# Ainda em apps/system-example/
npm run migration:create -- --name=InitialMigration
npm run migration:up
```

### 7. Iniciar Aplicação

```bash
npm run dev
```

Pronto! A aplicação está rodando em `http://localhost:3000` 🚀

### 8. Testar API

```bash
# Criar um usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Listar usuário (copie o ID retornado acima)
curl http://localhost:3000/users/<USER_ID>
```

## 📚 Próximos Passos

### Entender a Estrutura

1. Leia o [README.md](README.md) principal para entender o monorepo
2. Leia o [apps/system-example/README.md](apps/system-example/README.md) para entender o sistema de exemplo
3. Veja [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) para ver todos os arquivos criados

### Explorar o Código

#### 1. Domain Layer
Comece pelo domínio - onde está a lógica de negócio:

```
apps/system-example/src/contexts/user/domain/
├── entities/user.entity.ts          # ⭐ Comece aqui
├── value-objects/
│   ├── user-id.vo.ts
│   └── email.vo.ts
├── events/
└── exceptions/
```

#### 2. Application Layer
Veja como os casos de uso orquestram o domínio:

```
apps/system-example/src/contexts/user/application/
├── use-cases/
│   └── create-user/
│       └── create-user.use-case.ts   # ⭐ Use case exemplo
├── ports/output/
│   └── user-repository.port.ts      # ⭐ Interface (Port)
└── dto/
```

#### 3. Infrastructure Layer
Veja as implementações concretas (Adapters):

```
apps/system-example/src/infrastructure/
├── persistence/mikro-orm/
│   ├── repositories/
│   │   └── user.repository.ts       # ⭐ Implementação do Port
│   └── mappers/
│       └── user.mapper.ts           # ⭐ Domain <-> ORM
└── http/controllers/user/
    └── user.controller.ts           # ⭐ REST API
```

### Adicionar Nova Feature

Vamos adicionar uma feature "Update User Email" como exercício:

#### 1. Adicione método no Domain

```typescript
// apps/system-example/src/contexts/user/domain/entities/user.entity.ts
changeEmail(newEmail: Email): void {
  if (this._email.equals(newEmail)) {
    return;
  }
  const oldEmail = this._email.value;
  this._email = newEmail;
  this._updatedAt = new Date();
  this.addDomainEvent(
    new UserEmailChangedEvent(this._id.value, oldEmail, newEmail.value)
  );
}
```

#### 2. Crie o Use Case

```typescript
// apps/system-example/src/contexts/user/application/use-cases/update-email/
// - update-email.command.ts
// - update-email.use-case.ts
```

#### 3. Adicione no Module

```typescript
// apps/system-example/src/contexts/user/user.module.ts
providers: [
  // ... existentes
  UpdateEmailUseCase,
],
exports: [
  // ... existentes
  UpdateEmailUseCase,
],
```

#### 4. Adicione endpoint no Controller

```typescript
// apps/system-example/src/infrastructure/http/controllers/user/user.controller.ts
@Patch(':id/email')
async updateEmail(
  @Param('id') id: string,
  @Body() dto: UpdateEmailRequestDto,
): Promise<UserResponseDto> {
  const command = new UpdateEmailCommand(id, dto.email);
  const userDto = await this.updateEmailUseCase.execute(command);
  return UserResponseDto.fromDto(userDto);
}
```

#### 5. Teste

```bash
curl -X PATCH http://localhost:3000/users/<ID>/email \
  -H "Content-Type: application/json" \
  -d '{"email":"newemail@example.com"}'
```

## 🧪 Rodando Testes

```bash
# Da raiz do monorepo
npm run test

# Testes específicos
npm run test:unit          # Unit tests (domain/application)
npm run test:integration   # Integration tests
npm run test:e2e           # E2E tests

# Com coverage
cd apps/system-example
npm run test:cov
```

## 🔧 Comandos Úteis

### Root (monorepo)
```bash
npm run build              # Build de todos os workspaces
npm run lint               # Lint de todo o código
npm run format             # Formatar código
npm run typecheck          # Verificar tipos TypeScript
```

### System Example
```bash
cd apps/system-example

# Desenvolvimento
npm run dev                # Watch mode
npm run dev:debug          # Debug mode

# Build e produção
npm run build
npm run start:prod

# Database
npm run migration:create -- --name=MyMigration
npm run migration:up
npm run migration:down
npm run schema:fresh       # Drop + migrations
```

## 📖 Conceitos Importantes

### 1. Arquitetura Hexagonal

```
┌─────────────────────────────────────────┐
│          Infrastructure Layer           │
│   (HTTP, DB, Messaging - Adapters)     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │     Application Layer             │ │
│  │  (Use Cases, Ports, DTOs)         │ │
│  │                                   │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │    Domain Layer             │ │ │
│  │  │  (Entities, VOs, Events)    │ │ │
│  │  │                             │ │ │
│  │  │  ❤️  Regras de Negócio      │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Regra de Ouro**: As dependências apontam SEMPRE para dentro!

### 2. Ports & Adapters

- **Port** = Interface (contrato)
- **Adapter** = Implementação concreta

```typescript
// Port (Application Layer)
export interface UserRepositoryPort {
  save(user: User): Promise<User>;
}

// Adapter (Infrastructure Layer)
export class MikroOrmUserRepository implements UserRepositoryPort {
  async save(user: User): Promise<User> {
    // implementação com MikroORM
  }
}
```

### 3. Domain Events

```typescript
// 1. Entity emite evento
user.addDomainEvent(new UserCreatedEvent(...));

// 2. Repository publica após persistir
const events = user.pullDomainEvents();
await this.eventPublisher.publishAll(events);

// 3. Handler reage ao evento
@OnEvent('user.created')
async handle(event: UserCreatedEvent) {
  // enviar email, atualizar cache, etc
}
```

### 4. Unit of Work

```typescript
// Use case executa operações dentro de transação
const result = await this.unitOfWork.execute(async () => {
  const user = await this.userRepo.save(user);
  await this.profileRepo.save(profile);
  return user;
});
// Commit automático se sucesso, rollback se erro
```

## 🎯 Boas Práticas

### ✅ DO's

1. **Comece pelo Domain** - defina entidades e VOs primeiro
2. **Use Value Objects** para conceitos importantes (Email, UserId, etc)
3. **Emita Domain Events** para side effects
4. **Defina Ports** antes de implementar Adapters
5. **Mantenha Domain puro** - sem dependências de frameworks
6. **Use Mappers** para separar Domain de ORM
7. **Teste Domain/Application** sem infraestrutura
8. **Use Symbols** para DI type-safe

### ❌ DON'Ts

1. **Não coloque** lógica de negócio nos Controllers
2. **Não use** decorators de ORM nas entities de domínio
3. **Não injete** EntityManager diretamente nos Use Cases
4. **Não misture** responsabilidades entre camadas
5. **Não exponha** detalhes de infra no Domain/Application
6. **Não negligencie** testes
7. **Não ignore** Domain Events
8. **Não crie** God Classes ou God Modules

## 🐛 Troubleshooting

### Erro: Cannot find module '@gitspread/...'

```bash
# Rebuild dos pacotes
npm run build
# ou
cd packages/domain-primitives && npm run build
cd packages/shared-kernel && npm run build
```

### Erro de conexão com SQL Server

```bash
# Verificar se o container está rodando
docker ps

# Ver logs
docker logs sql-server

# Testar conexão
docker exec -it sql-server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "YourStrong@Passw0rd"
```

### Migration não funciona

```bash
# Verificar configuração do MikroORM
cat apps/system-example/src/infrastructure/persistence/mikro-orm/config/mikro-orm.config.ts

# Regenerar migrations
npm run schema:fresh
```

## 💡 Dicas

1. **Use o VSCode** - há ótimo suporte para TypeScript
2. **Instale extensões**: ESLint, Prettier, TypeScript
3. **Use breakpoints** para debug no NestJS
4. **Leia os testes** para entender como usar as classes
5. **Consulte a documentação** do NestJS e MikroORM
6. **Faça pequenos commits** frequentes
7. **Escreva testes** conforme desenvolve

## 📞 Ajuda

- Leia a [documentação do NestJS](https://docs.nestjs.com/)
- Leia a [documentação do MikroORM](https://mikro-orm.io/)
- Veja os exemplos no `system-example`
- Consulte o plano original em `~/.claude/plans/`

---

**Bom desenvolvimento! 🚀**
