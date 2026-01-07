# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is an **npm workspaces monorepo** implementing **Hexagonal Architecture** (Ports & Adapters) with:
- **packages/**: Shared libraries (`domain-primitives`, `shared-kernel`)
- **apps/**: Independent applications (currently `system-example`)

Stack: NestJS + Fastify + MikroORM + SQL Server + TypeScript (strict mode)

## Essential Commands

### Root-level (monorepo)
```bash
npm install                    # Install all workspace dependencies
npm run build                  # Build all workspaces
npm run lint                   # Lint entire codebase
npm run format                 # Format with Prettier
npm run typecheck              # TypeScript type checking
```

### Application-level (apps/system-example)
```bash
cd apps/system-example

# Development
npm run dev                    # Start with watch mode
npm run dev:debug              # Start with debugging enabled

# Database
npm run migration:create -- --name=YourMigrationName
npm run migration:up           # Run pending migrations
npm run migration:down         # Rollback last migration
npm run schema:fresh           # Drop schema + run migrations

# Testing
npm run test                   # Run all tests
npm run test:watch             # Watch mode
npm run test:cov               # Generate coverage report
npm run test -- path/to/test.spec.ts  # Run single test file
```

## Architecture Principles

### Hexagonal Architecture (Ports & Adapters)

**Dependency Rule**: Dependencies flow inward only: Infrastructure → Application → Domain

```
┌─────────────────────────────────┐
│     Infrastructure Layer        │  ← Adapters (HTTP, DB, Messaging)
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
- **HTTP Adapter** (`http/`): NestJS controllers, request/response DTOs
- **Persistence Adapter** (`persistence/mikro-orm/`):
  - `entities/`: ORM entities with MikroORM decorators (suffix: `-orm.entity.ts`)
  - `repositories/`: Implement domain repository ports
  - `mappers/`: Convert between domain entities and ORM entities
- **Messaging Adapter** (`messaging/`): Event publishers/subscribers

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

**ORM Entity** (with MikroORM decorators):
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

### 3. Unit of Work Pattern

Never inject `EntityManager` directly into use cases. Use `UnitOfWorkPort`:

```typescript
// Use case
async execute(command: CreateUserCommand): Promise<UserDto> {
  return this.unitOfWork.execute(async () => {
    // All operations here run in a transaction
    return this.userRepository.save(user);
  });
}
```

### 4. Domain Events Flow

1. **Entity emits**: `this.addDomainEvent(new UserCreatedEvent(...))`
2. **Repository publishes** (after successful persistence):
   ```typescript
   const events = user.pullDomainEvents();
   await this.eventPublisher.publishAll(events);
   ```
3. **Handlers react**:
   ```typescript
   @OnEvent('user.created')
   async handle(event: UserCreatedEvent) { /*...*/ }
   ```

## Adding New Features

### Creating a New Bounded Context

1. **Create folder structure**: `src/contexts/<context-name>/`
   - `domain/` (entities, VOs, events, exceptions)
   - `application/` (use-cases, ports, DTOs)
   - `<context-name>.module.ts`

2. **Domain Layer**:
   - Create entities (extend `AggregateRoot` for roots)
   - Create value objects (extend `ValueObject`)
   - Define domain events (extend `DomainEvent`)
   - Define domain exceptions (extend `DomainException`)

3. **Application Layer**:
   - Define repository ports in `application/ports/output/`
   - Create use cases implementing `UseCase<TCommand, TResult>`
   - Create DTOs for data transfer

4. **Infrastructure Layer**:
   - Create ORM entities in `infrastructure/persistence/mikro-orm/entities/`
   - Implement repositories in `infrastructure/persistence/mikro-orm/repositories/`
   - Create mappers in `infrastructure/persistence/mikro-orm/mappers/`
   - Create HTTP controllers in `infrastructure/http/controllers/<context>/`

5. **Module Configuration**:
   - Configure DI in `<context-name>.module.ts`
   - Import `MikroOrmModule.forFeature([OrmEntity])`
   - Register repositories with Symbol tokens
   - Export use cases

6. **Register Module**:
   - Import in `app.module.ts`
   - Import in `http.module.ts` (if exposing HTTP endpoints)

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
// 4. Inject in controller and create endpoint
```

## Package References

Shared packages are referenced via TypeScript path aliases:
- `@gitspread/domain-primitives` → `packages/domain-primitives/src`
- `@gitspread/shared-kernel` → `packages/shared-kernel/src`

Within an app:
- `@domain/*` → `src/contexts/*/domain/*`
- `@application/*` → `src/contexts/*/application/*`
- `@infrastructure/*` → `src/infrastructure/*`

## MikroORM Specifics

- Config: `src/infrastructure/persistence/mikro-orm/config/mikro-orm.config.ts`
- Migrations folder: `src/infrastructure/persistence/mikro-orm/migrations/`
- Always use `persistAndFlush()` in repositories
- ORM entities must have `-orm.entity.ts` suffix
- Database: SQL Server (MSSQL driver)

## Testing Strategy

- **Unit tests** (`test/unit/`): Domain entities, value objects, use cases (mock repositories)
- **Integration tests** (`test/integration/`): Repository implementations, database interactions
- **E2E tests** (`test/e2e/`): Full HTTP request/response cycles

Run specific test: `npm run test -- path/to/file.spec.ts`

## Common Pitfalls to Avoid

1. ❌ **Don't** add MikroORM decorators to domain entities
2. ❌ **Don't** inject `EntityManager` into use cases (use `UnitOfWorkPort`)
3. ❌ **Don't** put business logic in controllers (belongs in domain/use cases)
4. ❌ **Don't** expose domain entities directly via HTTP (use DTOs)
5. ❌ **Don't** skip mappers between Domain ↔ ORM ↔ HTTP DTOs
6. ❌ **Don't** forget to publish domain events after persistence
7. ❌ **Don't** use string tokens for DI (use Symbols)

## Environment Setup

1. Copy `.env.example` to `.env` in `apps/system-example/`
2. Configure SQL Server connection (or use Docker: `docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=..." -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest`)
3. Create database
4. Run migrations: `npm run migration:up`

## Development Best Practices (Backend)

### Controller Guidelines

**NEVER:**
- Open direct database connections
- Use manual SQL (always use ORM with mapped entities)
- Have multiple `catch` blocks in a single method
- Return `Ok()` for DELETE operations (use 204 No Content)

**ALWAYS:**
- Have exactly ONE `try-catch` per controller method
- Use constructor injection for dependencies
- Use Mappers for DTO ↔ Domain conversion
- Delegate complex logic to Use Cases
- Return `204 No Content` for successful DELETE

### Error Handling Standards

**Controller Error Pattern:**

```typescript
@Get(':id')
async getItem(@Param('id') id: string) {
  try {
    const item = await this.repository.findById(UserId.from(id));
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return ItemDto.fromDomain(item);
  } catch (error) {
    this.logger.error('Error getting item', error);
    throw; // Re-throw to preserve stack trace
  }
}
```

**Rules:**
- ONE `catch` block per controller method
- NEVER: Empty catch blocks
- NEVER: Rethrow with `throw error` (use `throw;` to preserve stack trace in some contexts, or just `throw error` in NestJS)
- ALWAYS: Log errors with context
- Services can propagate exceptions; controller handles final error response

### HTTP Status Code Standards

- **200 OK**: Successful GET/PUT with content
- **201 Created**: Successful POST; include `Location` header with new resource URI
- **204 No Content**: Successful DELETE (no response body)
- **400 Bad Request**: Validation failed or business rule violation
- **404 Not Found**: Resource not found
- **401 Unauthorized**: Authentication failed
- **403 Forbidden**: Insufficient permissions
- **500 Internal Server Error**: Unhandled exceptions (let NestJS exception filter handle)

### Service Layer Patterns

**Command/Query Separation:**
- **Commands**: Write operations (Create, Update, Delete) with transaction management
- **Queries**: Read operations optimized for performance (projections, caching)

**Transaction Management:**

```typescript
async saveEntity(entity: MyEntity): Promise<MyEntity> {
  return this.unitOfWork.execute(async () => {
    const saved = await this.repository.save(entity);

    // All operations here are in the same transaction
    await this.otherRepository.update(relatedData);

    return saved;
  });
  // Auto-commit on success, auto-rollback on error
}
```

**Rules:**
- Transactions managed in Use Cases, NOT Controllers
- Use `UnitOfWorkPort` abstraction (never inject EntityManager directly)
- Domain events published AFTER successful persistence
- Use `throw` to propagate errors and trigger rollback

### Strategy Pattern for Extensibility

When you have multiple implementations of the same interface, use Strategy pattern:

```typescript
// Define interface
export interface IFieldWriter {
  canHandle(dbType: string): boolean;
  write(field: KnowledgeField, value: any): KnowledgeData;
}

// Create implementations
@Injectable()
export class VarcharWriter implements IFieldWriter {
  canHandle(dbType: string) { return dbType === 'varchar'; }
  write(field: KnowledgeField, value: any) { /* ... */ }
}

@Injectable()
export class GuidWriter implements IFieldWriter {
  canHandle(dbType: string) { return dbType === 'uniqueidentifier'; }
  write(field: KnowledgeField, value: any) { /* ... */ }
}

// Use in service
@Injectable()
export class KnowledgeService {
  constructor(
    @Inject('FIELD_WRITERS')
    private readonly fieldWriters: IFieldWriter[],
  ) {}

  saveData(field: KnowledgeField, value: any) {
    const writer = this.fieldWriters.find(w => w.canHandle(field.type));
    if (!writer) throw new Error(`No writer for type: ${field.type}`);

    return writer.write(field, value);
  }
}

// Register in module
providers: [
  VarcharWriter,
  GuidWriter,
  // ... other writers
  {
    provide: 'FIELD_WRITERS',
    useFactory: (varchar: VarcharWriter, guid: GuidWriter) => [varchar, guid],
    inject: [VarcharWriter, GuidWriter],
  },
],
```

### Validation & Invariants

**Domain Validation:**
- Validate in entity constructors and domain methods
- Throw specific exception types from `@gitspread/domain-primitives`
- Ensure entities are always in valid state

**DTO Validation:**
- Use `class-validator` decorators on request DTOs
- Validation pipe auto-validates before reaching controller

### Nullability Best Practices

- Align TypeScript types with database schema
- Use `!` or `?` operators appropriately for nullable fields
- Make required relationships non-nullable in types
- Document nullability expectations in interfaces

## Key Files to Reference

- **Domain example**: `apps/system-example/src/contexts/user/domain/entities/user.entity.ts`
- **Use case example**: `apps/system-example/src/contexts/user/application/use-cases/create-user/create-user.use-case.ts`
- **Repository implementation**: `apps/system-example/src/infrastructure/persistence/mikro-orm/repositories/user.repository.ts`
- **Mapper example**: `apps/system-example/src/infrastructure/persistence/mikro-orm/mappers/user.mapper.ts`
- **Controller example**: `apps/system-example/src/infrastructure/http/controllers/user/user.controller.ts`

---

# Frontend Development Guidelines

## Project Structure (When Adding Frontend)

Frontend applications should be placed in a separate directory within the monorepo:

```
GitSpread/
├── apps/
│   ├── system-example/          # Backend
│   └── system-example-web/      # Frontend (if needed)
└── packages/
```

## Frontend Best Practices

### 1. Component Structure

#### Pages
- Main page files in `src/pages/{PageName}/index.tsx` and `styles.ts`
- **CRITICAL**: Every protected page MUST use authentication wrapper component
- Page subcomponents in `src/pages/{PageName}/components/`
- **Dialog components**: Always implement as subcomponents, never inline

#### Components
- General-purpose components in `src/components/{ComponentName}/index.tsx`
- Create `styles.ts` when styling is needed
- Use named exports (avoid `export default` for components)

#### Services
- Organize by resource: `src/services/{resource}Service.ts`
- Configure axios in `src/services/api.ts`

**Service Pattern:**

```typescript
import api from 'src/services/api';

async function getById(id: number) {
  return api.get<IUser>(`users/${id}`);
}

async function create(user: CreateUserDto) {
  return api.post('users', user);
}

async function update(id: string, user: UpdateUserDto) {
  return api.put(`users/${id}`, user);
}

const userService = {
  getById,
  create,
  update,
};

export default userService;
```

### 2. Coding Standards

#### Component Declarations

**✅ CORRECT:**
```typescript
export function MyPage() {
  return <div>Content</div>;
}
```

**❌ INCORRECT:**
```typescript
const MyPage = () => <div>Content</div>; // NEVER do this
export default MyPage; // Avoid default exports
```

#### Variable and Function Declarations

- Use `const` only for hooks or variables
- Use `function` for all function declarations
- In utils/helpers: `export function` instead of `export const`

#### Exports

- **Avoid `export default`** for components
- `export default` acceptable only for service modules
- Use named exports: `export function convertTime`

#### TypeScript

- **Avoid `any`**: Use explicit types
- **Local vs Global Types**:
  - Types used only within component: declare at file beginning (outside function)
  - Reusable types: place in `src/types/{entity}.ts`
  - **NEVER declare types inside functions**

**Component Props Naming:**

```typescript
interface MyPageProps {
  userId: string;
  onSave: () => void;
}

export function MyPage(props: MyPageProps) {
  // implementation
}
```

### 3. HTML & Semantic Markup

**ALWAYS use semantic HTML** - this is mandatory:

**Common semantic elements:**
- `<header>` - Headers, navigation bars
- `<main>` - Main content area
- `<nav>` - Navigation, pagination
- `<section>` - Thematic content grouping
- `<article>` - Self-contained content (cards, list items)
- `<aside>` - Sidebar, complementary info
- `<footer>` - Footers

**✅ CORRECT:**
```tsx
<Container>
  <Header>
    <Navbar>...</Navbar>
  </Header>

  <Main>
    <Section>
      <Article>Card content</Article>
    </Section>

    <Nav aria-label="Pagination">
      <Pagination />
    </Nav>
  </Main>
</Container>
```

**❌ INCORRECT:**
```tsx
<div>
  <div className="header">...</div>
  <div className="content">...</div>
</div>
```

**Accessibility:**
- Add ARIA roles: `role="status"` for loading, `role="alert"` for errors
- Use `aria-label` for sections
- Ensure keyboard navigation works

### 4. Styling Guidelines

#### Material-UI (MUI)

- Always consult documentation before using MUI components
- Use MUI components for all UI elements
- For complex styles, move to `styles.ts` using MUI's `styled`
- Use Material-UI Icons

#### Styled Components Best Practices

**CRITICAL RULES:**

1. **NEVER use inline styles**
2. **One styled component per visual element**
3. **Hybrid approach**: Use both `styled-components` and `@mui/material/styles`
4. **Semantic element mapping**: Wrap semantic HTML elements

**❌ INCORRECT:**

```typescript
// styles.ts - BAD
export const Container = styled.div`
  .header { margin-bottom: 1rem; }
  .content { padding: 1rem; }
`;

// index.tsx - BAD
<Container>
  <div className="header">...</div>
  <span style={{ color: 'red' }}>Error</span> {/* inline! */}
</Container>
```

**✅ CORRECT:**

```typescript
// styles.ts - GOOD
import styled from 'styled-components';
import { styled as muiStyled } from '@mui/material/styles';

// Simple layouts with styled-components
export const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

export const Header = styled.header`
  margin-bottom: 1rem;
`;

// Theme access with MUI styled
export const ErrorText = muiStyled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: theme.typography.body2.fontSize,
}));

// index.tsx - GOOD
<Container>
  <Header>...</Header>
  <ErrorText>Error message</ErrorText>
</Container>
```

**Key principles:**
- Each visual element = one styled component
- Use `styled` from `styled-components` for simple layouts
- Use `styled as muiStyled` from `@mui/material/styles` for theme access
- Access MUI theme: `muiStyled('span')(({ theme }) => ({ ... }))`
- Never use `className` or `style` props

#### Colors

- **Never use inline colors** (RGB/hex)
- Always use `theme.palette` colors
- Customize theme in `src/styles/theme.ts`
- Extend types in `src/@types/theme.d.ts`

### 5. Form Handling

- Use **react-hook-form** with **yup** validation
- Consult documentation before implementing validations

```typescript
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const validationSchema = yup.object({
  email: yup.string().email('Invalid email').required('Email required'),
  name: yup.string().required('Name required'),
});

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(validationSchema),
  });

  const onSubmit = (data) => {
    // handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

### 6. User Notifications

**ALWAYS use notification context/hook** for user feedback:

```typescript
import { useSnackbar } from 'src/contexts/snackbarContext';

export function MyPage() {
  const { showMessage } = useSnackbar();

  async function loadData() {
    try {
      const data = await service.getData();
      showMessage('Data loaded successfully', 'success');
    } catch (error: any) {
      showMessage(error.message || 'Error loading data', 'error');
    }
  }

  // ...
}
```

**Severity types:**
- `'error'` - Red alert
- `'success'` - Green alert
- `'warning'` - Orange alert
- `'info'` - Blue alert (default)

### 7. Import Configuration

**ALWAYS use `src/` imports:**

```typescript
// ✅ CORRECT
import api from 'src/services/api';
import { useAuth } from 'src/hooks/useAuth';

// ❌ INCORRECT
import api from '../../services/api';
import { useAuth } from '../../../hooks/useAuth';
```

### 8. Environment Variables

- Use `.env.development`, `.env.production`, `.env.example`
- Prefix with `VITE_` for Vite or `REACT_APP_` for Create React App
- Never commit actual `.env` files

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_APP_VERSION=1.0.0
```

### 9. State Management

- Use React Context API for global state
- Create context providers for feature-specific state
- Use custom hooks to consume contexts

```typescript
// contexts/authContext.tsx
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// hooks/useAuth.ts
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 10. Error Handling in Services

**Standard error handling pattern:**

```typescript
async function loadData() {
  try {
    setLoading(true);
    const response = await service.getData();
    setData(response.data);
  } catch (error: any) {
    showMessage(error.userMessage || 'Error loading data', 'error');
    console.error('Load data error:', error);
  } finally {
    setLoading(false);
  }
}
```

### 11. Naming Conventions

- **Code and comments**: English
- **UI labels and messages**: Portuguese (or target language)
- **Files**: camelCase for utilities, PascalCase for components
- **Variables**: camelCase
- **Components**: PascalCase
- **Constants**: UPPER_SNAKE_CASE

### 12. Frontend Testing (When Implemented)

- **Unit tests**: Component logic, utilities
- **Integration tests**: Component interactions
- **E2E tests**: User workflows

Use Vitest + React Testing Library for testing:

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```
