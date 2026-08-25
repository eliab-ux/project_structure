# 🚀 GUIA IMPLEMENTAÇÃO - KAZA TEM SYSTEM

**Projeto:** E-commerce com Sistema de Revendedores  
**Arquitetura:** Hexagonal (Ports & Adapters)  
**Stack:** NestJS + Next.js 14 + PostgreSQL (Supabase)  
**Data:** Janeiro 2025

---

## ⚠️ ANTES DE COMEÇAR - LEITURA OBRIGATÓRIA

### 📚 Documentos de Referência (Ordem CRÍTICA)

```
PRIORIDADE 1 - PADRÕES DE CÓDIGO:
┌─────────────────────────────────────┐
│ /mnt/project/CLAUDE.md              │ ← LER COMPLETAMENTE
│                                     │
│ ✅ Backend: Hexagonal, DI, Mappers  │
│ ✅ Frontend: Components, Styling    │
│ ✅ Error Handling, HTTP Status      │
│ ✅ DO's and DON'Ts                  │
└─────────────────────────────────────┘

PRIORIDADE 2 - ESPECIFICAÇÕES DO PROJETO:
┌─────────────────────────────────────┐
│ REQUISITOS_KAZA_TEM_SYSTEM.md       │
│                                     │
│ ✅ Design System (Seção 2)          │
│ ✅ Schemas PostgreSQL (Seção 6)     │
│ ✅ Product Context (Seção 8.1)      │
│ ✅ Componentes Visuais (Seção 3.4)  │
│ ✅ Mockups ASCII (Seção 3.6)        │
└─────────────────────────────────────┘

PRIORIDADE 3 - ESTRUTURA DE REFERÊNCIA:
┌─────────────────────────────────────┐
│ /mnt/project/GETTING_STARTED.md     │ ← Setup básico
│ /mnt/project/PROJECT_STRUCTURE.md   │ ← Estrutura
└─────────────────────────────────────┘
```

### 🎯 Regra de Ouro

**EM CASO DE CONFLITO:**
```
CLAUDE.md > REQUISITOS_KAZA_TEM_SYSTEM.md > Outros documentos
```

---

## 📋 CHECKLIST PRÉ-IMPLEMENTAÇÃO

### ✅ Conhecimento Adquirido

Marque conforme ler e entender:

**Backend (do CLAUDE.md):**
- [ ] Entendi Arquitetura Hexagonal (3 camadas)
- [ ] Entendi Domain Entity ≠ ORM Entity
- [ ] Entendi Dependency Injection com Symbols
- [ ] Entendi Unit of Work pattern
- [ ] Entendi Mappers bidirecionais
- [ ] Entendi Domain Events flow
- [ ] Entendi Controller patterns (1 try-catch, status codes)
- [ ] Entendi Strategy pattern

**Frontend (do CLAUDE.md):**
- [ ] Entendi função declarada vs arrow function
- [ ] Entendi export vs export default
- [ ] Entendi styled components (1 por elemento)
- [ ] Entendi HTML semântico
- [ ] Entendi imports com `src/`
- [ ] Entendi validação com react-hook-form + yup
- [ ] Entendi Context API para state
- [ ] Entendi zero `any` em TypeScript

**Projeto Kaza Tem (dos REQUISITOS):**
- [ ] Li Design System (paleta cores, tipografia)
- [ ] Li Schemas PostgreSQL (19 tabelas)
- [ ] Li Product Context completo
- [ ] Li Componentes Visuais
- [ ] Vi Mockups ASCII
- [ ] Entendi integração Bling/Magis5/Cielo

---

## 🛠️ FASE 0: SETUP INICIAL (30-60 min)

### 0.1 Criar Projeto Supabase

```bash
# 1. Acesse: https://supabase.com
# 2. Sign up (recomendo usar GitHub OAuth)
# 3. Criar novo projeto:

Configuração:
├─ Nome: kaza-tem-production
├─ Database Password: [CRIAR SENHA FORTE - ANOTAR EM LOCAL SEGURO]
├─ Region: South America (São Paulo) - mais próximo do Brasil
└─ Plan: Free (500MB DB + 1GB Storage - suficiente para MVP)

# 4. Aguardar ~2 min (provisioning do banco)
```

### 0.2 Obter Credenciais Supabase

```bash
# No Supabase Dashboard:

1. Settings > Database:
   ┌────────────────────────────────────────────────────────────┐
   │ Connection string (URI):                                   │
   │ postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432 │
   └────────────────────────────────────────────────────────────┘
   
   COPIAR E ANOTAR ↑

2. Settings > API:
   ┌────────────────────────────────────────────────────────────┐
   │ Project URL:                                               │
   │ https://[PROJECT-REF].supabase.co                          │
   │                                                            │
   │ anon public (Frontend):                                    │
   │ eyJhbGc... [~200 caracteres]                               │
   │                                                            │
   │ service_role (Backend - SECRETO):                          │
   │ eyJhbGc... [~200 caracteres]                               │
   └────────────────────────────────────────────────────────────┘
   
   COPIAR TODOS ↑
```

### 0.3 Estrutura de Diretórios

```bash
cd /caminho/do/GitSpread

# Criar estrutura do Kaza Tem System
mkdir -p apps/kaza-tem-system/{backend,frontend}

# Backend - Contextos
cd apps/kaza-tem-system/backend
mkdir -p src/contexts/{product,reseller,order,commission,subscription,withdrawal,marketing,analytics,user}

# Backend - Cada contexto com 3 camadas
for ctx in product reseller order commission subscription withdrawal marketing analytics user; do
  mkdir -p src/contexts/$ctx/{domain,application}
  mkdir -p src/contexts/$ctx/domain/{entities,value-objects,events,exceptions}
  mkdir -p src/contexts/$ctx/application/{use-cases,ports,dto}
  mkdir -p src/contexts/$ctx/application/ports/{input,output}
done

# Backend - Infrastructure
mkdir -p src/infrastructure/{http,persistence,integrations,messaging}
mkdir -p src/infrastructure/http/controllers
mkdir -p src/infrastructure/persistence/mikro-orm/{entities,repositories,mappers,migrations,config,ports}
mkdir -p src/infrastructure/integrations/{bling,magis5,cielo,melhor-envio}
mkdir -p src/infrastructure/messaging/publishers

# Config e Testes
mkdir -p src/config
mkdir -p test/{unit,integration,e2e}
```

### 0.4 Backend - package.json

```bash
cd apps/kaza-tem-system/backend
```

Criar `package.json`:

```json
{
  "name": "@kaza-tem/backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "dev:debug": "nest start --debug --watch",
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "migration:create": "mikro-orm migration:create",
    "migration:up": "mikro-orm migration:up",
    "migration:down": "mikro-orm migration:down",
    "migration:pending": "mikro-orm migration:pending",
    "schema:drop": "mikro-orm schema:drop --run",
    "schema:fresh": "npm run schema:drop && npm run migration:up",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:unit": "jest --testPathPattern=test/unit",
    "test:integration": "jest --testPathPattern=test/integration",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-fastify": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/event-emitter": "^2.0.3",
    "@nestjs/schedule": "^4.0.0",
    "@mikro-orm/core": "^6.0.0",
    "@mikro-orm/postgresql": "^6.0.0",
    "@mikro-orm/nestjs": "^5.2.3",
    "@supabase/supabase-js": "^2.39.0",
    "pg": "^8.11.3",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "axios": "^1.6.2",
    "date-fns": "^3.0.6",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1",
    "@gitspread/domain-primitives": "workspace:*",
    "@gitspread/shared-kernel": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/node": "^20.11.0",
    "@types/jest": "^29.5.11",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "prettier": "^3.2.4",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

```bash
npm install
```

### 0.5 Backend - .env

Criar `.env`:

```env
# ============================================
# DATABASE (SUPABASE POSTGRESQL)
# ============================================
DATABASE_URL=postgresql://postgres:[SUA-SENHA-AQUI]@db.[SEU-PROJECT-REF].supabase.co:5432/postgres

# ============================================
# SUPABASE
# ============================================
SUPABASE_URL=https://[SEU-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[SUA-ANON-KEY-AQUI]
SUPABASE_SERVICE_ROLE_KEY=[SUA-SERVICE-ROLE-KEY-AQUI]

# ============================================
# JWT (Auth)
# ============================================
JWT_SECRET=mude-para-uma-string-aleatoria-de-32-caracteres-em-producao
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=outro-secret-aleatorio-para-refresh-token
JWT_REFRESH_EXPIRES_IN=30d

# ============================================
# APPLICATION
# ============================================
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# ============================================
# BLING INTEGRATION (preencher depois)
# ============================================
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=http://localhost:3000/api/integrations/bling/callback
BLING_API_URL=https://www.bling.com.br/Api/v3

# ============================================
# MAGIS5 INTEGRATION (preencher depois)
# ============================================
MAGIS5_API_URL=https://api.magis5.com
MAGIS5_API_KEY=

# ============================================
# CIELO PAYMENT (preencher depois)
# ============================================
CIELO_MERCHANT_ID=
CIELO_MERCHANT_KEY=
CIELO_API_URL=https://api.cieloecommerce.cielo.com.br
CIELO_QUERY_URL=https://apiquery.cieloecommerce.cielo.com.br
CIELO_RECURRENCE_URL=https://api.cieloecommerce.cielo.com.br/1/RecurrentPayment

# ============================================
# MELHOR ENVIO (preencher depois)
# ============================================
MELHOR_ENVIO_API_URL=https://melhorenvio.com.br/api/v2
MELHOR_ENVIO_TOKEN=

# ============================================
# SYSTEM CONFIG
# ============================================
SUBSCRIPTION_PRICE=9.90
WITHDRAWAL_MIN_AMOUNT=50.00
WITHDRAWAL_RELEASE_DAYS=30
```

### 0.6 Backend - tsconfig.json

Criar `tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@domain/*": ["src/contexts/*/domain/*"],
      "@application/*": ["src/contexts/*/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@gitspread/domain-primitives": ["../../../packages/domain-primitives/src"],
      "@gitspread/shared-kernel": ["../../../packages/shared-kernel/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 0.7 Backend - MikroORM Config

Criar `src/infrastructure/persistence/mikro-orm/config/mikro-orm.config.ts`:

```typescript
import { defineConfig } from '@mikro-orm/postgresql';
import { join } from 'path';

export default defineConfig({
  dbName: 'postgres',
  clientUrl: process.env.DATABASE_URL,
  entities: ['./dist/**/*-orm.entity.js'],
  entitiesTs: ['./src/**/*-orm.entity.ts'],
  migrations: {
    path: join(__dirname, '../migrations'),
    pathTs: join(__dirname, '../migrations'),
    tableName: 'mikro_orm_migrations',
    transactional: true,
    disableForeignKeys: false,
  },
  debug: process.env.NODE_ENV === 'development',
  allowGlobalContext: true,
});
```

Criar `mikro-orm.config.ts` na raiz do backend:

```typescript
export default require('./src/infrastructure/persistence/mikro-orm/config/mikro-orm.config').default;
```

### 0.8 Frontend Setup

```bash
cd ../frontend

# Criar Next.js 14 com App Router
npx create-next-app@14 . --typescript --app --no-tailwind --no-src-dir

# Instalar dependências UI
npm install @mui/material @emotion/react @emotion/styled
npm install styled-components
npm install @mui/icons-material

# Instalar dependências forms e validation
npm install react-hook-form yup @hookform/resolvers

# Instalar HTTP client
npm install axios

# Instalar notifications
npm install notistack

# Instalar Supabase client
npm install @supabase/supabase-js

# Instalar outras libs úteis
npm install date-fns
npm install react-number-format
npm install react-loading-skeleton
```

### 0.9 Frontend - .env.local

Criar `.env.local`:

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Supabase (Frontend - apenas chaves públicas)
NEXT_PUBLIC_SUPABASE_URL=https://[SEU-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[SUA-ANON-KEY-AQUI]

# App Info
NEXT_PUBLIC_APP_NAME=Kaza Tem Imports
```

---

## 📐 FASE 1: BACKEND - PRODUCT CONTEXT (6-8 horas)

### Objetivo
Criar contexto de produtos com sincronização Bling/Magis5

### Checklist de Implementação

#### 1.1 Domain Layer ✅

**Arquivo: `src/contexts/product/domain/entities/product.entity.ts`**

```typescript
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ProductId } from '../value-objects/product-id.vo';
import { SKU } from '../value-objects/sku.vo';
import { Price } from '../value-objects/price.vo';
import { Stock } from '../value-objects/stock.vo';
import { ProductCreatedEvent } from '../events/product-created.event';
import { StockUpdatedEvent } from '../events/stock-updated.event';

export class Product extends AggregateRoot {
  private constructor(
    private readonly _id: ProductId,
    private readonly _blingId: string,
    private readonly _sku: SKU,
    private _name: string,
    private _description: string,
    private _price: Price,
    private _costPrice: Price,
    private _stock: Stock,
    private _categoryId: string | null,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(
    blingId: string,
    sku: SKU,
    name: string,
    description: string,
    price: Price,
    costPrice: Price,
    stock: Stock,
    categoryId?: string,
  ): Product {
    const product = new Product(
      ProductId.generate(),
      blingId,
      sku,
      name,
      description,
      price,
      costPrice,
      stock,
      categoryId || null,
      true,
      new Date(),
      new Date(),
    );

    product.addDomainEvent(
      new ProductCreatedEvent(product.id.value, sku.value, name),
    );

    return product;
  }

  // Método para reconstitute (carregar do banco)
  static reconstitute(
    id: ProductId,
    blingId: string,
    sku: SKU,
    name: string,
    description: string,
    price: Price,
    costPrice: Price,
    stock: Stock,
    categoryId: string | null,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Product {
    return new Product(
      id,
      blingId,
      sku,
      name,
      description,
      price,
      costPrice,
      stock,
      categoryId,
      isActive,
      createdAt,
      updatedAt,
    );
  }

  updateStock(newStock: Stock): void {
    if (this._stock.value !== newStock.value) {
      const oldStock = this._stock;
      this._stock = newStock;
      this._updatedAt = new Date();

      this.addDomainEvent(
        new StockUpdatedEvent(
          this._id.value,
          this._sku.value,
          oldStock.value,
          newStock.value,
        ),
      );
    }
  }

  updatePrice(newPrice: Price): void {
    this._price = newPrice;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  // Getters
  get id(): ProductId { return this._id; }
  get blingId(): string { return this._blingId; }
  get sku(): SKU { return this._sku; }
  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get price(): Price { return this._price; }
  get costPrice(): Price { return this._costPrice; }
  get stock(): Stock { return this._stock; }
  get categoryId(): string | null { return this._categoryId; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}
```

**VALIDAÇÃO:**
- [ ] Extends AggregateRoot ✅
- [ ] Constructor privado ✅
- [ ] Método static create() ✅
- [ ] Método static reconstitute() ✅
- [ ] Domain events emitidos ✅
- [ ] Sem dependências de frameworks ✅
- [ ] Getters imutáveis (sem setters públicos) ✅

**Criar Value Objects:**
- [ ] `src/contexts/product/domain/value-objects/product-id.vo.ts`
- [ ] `src/contexts/product/domain/value-objects/sku.vo.ts`
- [ ] `src/contexts/product/domain/value-objects/price.vo.ts`
- [ ] `src/contexts/product/domain/value-objects/stock.vo.ts`

**Criar Events:**
- [ ] `src/contexts/product/domain/events/product-created.event.ts`
- [ ] `src/contexts/product/domain/events/stock-updated.event.ts`

**Criar Exceptions:**
- [ ] `src/contexts/product/domain/exceptions/product-not-found.exception.ts`
- [ ] `src/contexts/product/domain/exceptions/invalid-sku.exception.ts`

#### 1.2 Application Layer ✅

**Arquivo: `src/contexts/product/application/ports/output/product-repository.port.ts`**

```typescript
import { Product } from '../../../domain/entities/product.entity';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { SKU } from '../../../domain/value-objects/sku.vo';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepositoryPort {
  save(product: Product): Promise<Product>;
  findById(id: ProductId): Promise<Product | null>;
  findBySKU(sku: SKU): Promise<Product | null>;
  findByBlingId(blingId: string): Promise<Product | null>;
  findAll(filters?: ProductFilters): Promise<Product[]>;
  findByCategory(categoryId: string): Promise<Product[]>;
  searchByName(query: string): Promise<Product[]>;
  delete(id: ProductId): Promise<void>;
}

export interface ProductFilters {
  isActive?: boolean;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}
```

**VALIDAÇÃO:**
- [ ] Interface definida (Port) ✅
- [ ] Symbol para DI ✅
- [ ] Métodos retornam Domain entities ✅
- [ ] Sem dependências de ORM ✅

**Criar Use Cases:**
- [ ] `src/contexts/product/application/use-cases/sync-products-from-bling/`
- [ ] `src/contexts/product/application/use-cases/get-product/`
- [ ] `src/contexts/product/application/use-cases/search-products/`
- [ ] `src/contexts/product/application/use-cases/update-stock/`

**Criar DTOs:**
- [ ] `src/contexts/product/application/dto/product.dto.ts`

#### 1.3 Infrastructure Layer ✅

**Arquivo: `src/infrastructure/persistence/mikro-orm/entities/product-orm.entity.ts`**

```typescript
import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'products' })
export class ProductOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string;

  @Property({ type: 'varchar', length: 50, unique: true })
  @Index()
  blingId: string;

  @Property({ type: 'varchar', length: 100, unique: true })
  @Index()
  sku: string;

  @Property({ type: 'varchar', length: 255 })
  name: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Property({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice?: number;

  @Property({ type: 'int' })
  stock: number;

  @Property({ type: 'uuid', nullable: true })
  @Index()
  categoryId?: string;

  @Property({ type: 'boolean', default: true })
  isActive: boolean;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt: Date;
}
```

**VALIDAÇÃO:**
- [ ] @Entity decorator ✅
- [ ] Sufixo `-orm.entity.ts` ✅
- [ ] Tipos PostgreSQL (uuid, timestamp, boolean) ✅
- [ ] Índices criados ✅
- [ ] Sem lógica de negócio ✅

**Criar Mapper:**
- [ ] `src/infrastructure/persistence/mikro-orm/mappers/product.mapper.ts`
  - Método `toDomain(orm: ProductOrmEntity): Product`
  - Método `toOrm(domain: Product): ProductOrmEntity`

**Criar Repository:**
- [ ] `src/infrastructure/persistence/mikro-orm/repositories/product.repository.ts`
  - Implementa `ProductRepositoryPort`
  - Usa `ProductMapper`
  - Publica Domain Events após persistir

**Criar Controller:**
- [ ] `src/infrastructure/http/controllers/product/product.controller.ts`
  - GET /products
  - GET /products/:id
  - POST /products/sync (admin only)

**Criar Module:**
- [ ] `src/contexts/product/product.module.ts`
  - Import MikroOrmModule.forFeature([ProductOrmEntity])
  - Provide PRODUCT_REPOSITORY com useClass: MikroOrmProductRepository
  - Export use cases

#### 1.4 Criar Schemas no Supabase

```sql
-- No Supabase Dashboard > SQL Editor > New query:

-- Tabela: products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bling_id VARCHAR(50) UNIQUE NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  stock INT NOT NULL DEFAULT 0,
  category_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_bling_id ON products(bling_id);
CREATE INDEX idx_products_category ON products(category_id);

-- Tabela: product_images
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  url VARCHAR(500) NOT NULL,
  position INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- Tabela: product_categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (parent_id) REFERENCES product_categories(id)
);
```

**EXECUTAR NO SUPABASE:**
1. Dashboard > SQL Editor
2. Cole o SQL acima
3. Run

#### 1.5 Testar Backend

```bash
cd apps/kaza-tem-system/backend
npm run dev

# Em outro terminal, testar endpoints:

# Sincronizar produtos do Bling (mock para teste)
curl -X POST http://localhost:3000/api/products/sync

# Listar produtos
curl http://localhost:3000/api/products

# Buscar produto específico
curl http://localhost:3000/api/products/[ID]
```

---

## 🎨 FASE 2: FRONTEND - CATÁLOGO (8-10 horas)

### Objetivo
Interface de e-commerce com design Mercado Livre/Amazon

### Checklist de Implementação

#### 2.1 Theme Setup ✅

**Arquivo: `src/styles/theme.ts`**

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#FFE600', // Amarelo Kaza Tem
      dark: '#F2C94C',
    },
    secondary: {
      main: '#3483FA', // Azul ML
    },
    success: {
      main: '#00A650', // Verde frete grátis
    },
    error: {
      main: '#F23D4F', // Vermelho erros
    },
    warning: {
      main: '#FF6900', // Laranja ofertas
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: 28, fontWeight: 700 },
    h2: { fontSize: 24, fontWeight: 700 },
    h3: { fontSize: 20, fontWeight: 600 },
    body1: { fontSize: 14 },
    body2: { fontSize: 12 },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          backgroundColor: '#FFE600',
          color: '#000',
          '&:hover': {
            backgroundColor: '#F2C94C',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
  },
});
```

**VALIDAÇÃO:**
- [ ] Paleta de cores correta (amarelo #FFE600, azul #3483FA, verde #00A650) ✅
- [ ] Tipografia Roboto ✅
- [ ] Customização de MUI components ✅

#### 2.2 Criar Componentes Base

**Header:**
- [ ] `src/components/Header/index.tsx` (função declarada, não arrow)
- [ ] `src/components/Header/styles.ts` (styled components)
- [ ] Background amarelo (#FFE600)
- [ ] Logo à esquerda
- [ ] SearchBar centralizada
- [ ] Ícones: Carrinho (badge), Favoritos, Menu usuário

**ProductCard:**
- [ ] `src/components/ProductCard/index.tsx`
- [ ] `src/components/ProductCard/styles.ts`
- [ ] Hover effect (translateY -4px + sombra)
- [ ] Badge de desconto (vermelho)
- [ ] Badge frete grátis (verde)
- [ ] Preço tachado + atual
- [ ] Parcelamento

**VALIDAÇÃO (para CADA componente):**
- [ ] Função declarada: `export function MyComponent()` ✅
- [ ] Sem `export default` ✅
- [ ] Props com interface nomeada ✅
- [ ] Styled components (não inline styles) ✅
- [ ] HTML semântico (`<section>`, `<article>`, etc) ✅
- [ ] Zero `any` ✅

#### 2.3 Páginas

**Homepage:**
- [ ] `src/app/page.tsx`
- [ ] Hero banner (carrossel)
- [ ] Grid de categorias (cards visuais)
- [ ] Grid de produtos em destaque (4 colunas desktop, 2 mobile)
- [ ] Banner de revendedor

**Listagem:**
- [ ] `src/app/products/page.tsx`
- [ ] FilterSidebar (desktop) / FilterDrawer (mobile)
- [ ] ProductGrid responsivo
- [ ] Breadcrumb
- [ ] Paginação

**Detalhes:**
- [ ] `src/app/products/[id]/page.tsx`
- [ ] ProductGallery (zoom, lightbox)
- [ ] PriceDisplay
- [ ] ShippingCalculator
- [ ] Botão "Adicionar ao Carrinho"

---

## ✅ CHECKLIST DE VALIDAÇÃO FINAL

### Backend

**Arquitetura Hexagonal:**
- [ ] Domain entities sem decorators de framework
- [ ] Application ports (interfaces) definidas com Symbols
- [ ] Infrastructure adapters implementam ports
- [ ] Mappers entre Domain ↔ ORM
- [ ] Unit of Work para transações
- [ ] Domain Events emitidos e publicados

**Código:**
- [ ] Um try-catch por controller method
- [ ] Status HTTP corretos (200, 201, 204, 404)
- [ ] DELETE retorna 204 No Content
- [ ] Sem lógica de negócio em controllers
- [ ] Sem `EntityManager` injetado em use cases

### Frontend

**Componentes:**
- [ ] Funções declaradas (não arrow)
- [ ] Sem `export default`
- [ ] Props com interface nomeada
- [ ] Styled components (1 por elemento)
- [ ] HTML semântico
- [ ] Zero `any`
- [ ] Imports com `src/`

**Visual:**
- [ ] Paleta de cores seguida
- [ ] Tipografia Roboto
- [ ] Hover effects implementados
- [ ] Skeleton loading
- [ ] Responsividade testada
- [ ] Badges coloridos corretos

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot connect to Supabase"

```bash
# Verificar credenciais no .env
cat .env | grep SUPABASE

# Testar conexão diretamente
node -e "require('pg').Client({connectionString:process.env.DATABASE_URL}).connect().then(()=>console.log('OK'))"
```

### Erro: "Migration not found"

```bash
# Verificar config do MikroORM
cat mikro-orm.config.ts

# Recriar migrations
npm run migration:create -- --name=Initial
npm run migration:up
```

### Erro: "Port 3000 already in use"

```bash
# Matar processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Ou usar outra porta
PORT=3001 npm run dev
```

---

## 📚 RECURSOS ÚTEIS

### Documentação Oficial
- [NestJS Docs](https://docs.nestjs.com/)
- [MikroORM Docs](https://mikro-orm.io/)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js 14 Docs](https://nextjs.org/docs)
- [MUI Docs](https://mui.com/)

### Consulta Rápida
- CLAUDE.md - Padrões de código
- REQUISITOS_KAZA_TEM_SYSTEM.md - Especificações completas
- Seção 8.1 - Product Context exemplo completo
- Seção 3.4 - Componentes visuais
- Seção 3.6 - Mockups ASCII

---

## 🎯 PRÓXIMAS FASES

Após completar Fase 1 e 2:

**Fase 3:** Sistema de Revendedores (Reseller Context)
**Fase 4:** Dashboard do Revendedor
**Fase 5:** Sistema de Comissões
**Fase 6:** Sistema de Saques
**Fase 7:** Integração Bling Completa
**Fase 8:** Funcionalidades Adicionais

---

**✅ Checklist Geral:**
- [ ] Li CLAUDE.md completamente
- [ ] Li REQUISITOS_KAZA_TEM_SYSTEM.md (seções críticas)
- [ ] Setup Supabase concluído
- [ ] Backend Product Context implementado
- [ ] Frontend Catálogo implementado
- [ ] Testes manuais passando
- [ ] Código validado contra CLAUDE.md
- [ ] Commit feito com mensagem descritiva

---

**BOM TRABALHO! 🚀**

Versão: 1.0  
Data: Janeiro 2025  
Projeto: Kaza Tem E-commerce com Revendedores
