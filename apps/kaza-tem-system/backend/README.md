# Kaza Tem System — Backend Hexagonal

Este workspace implementa o **Kaza Tem System** com NestJS, MikroORM e PostgreSQL hospedado no Supabase. A proposta é orquestrar os bounded contexts de **Usuários**, **Produtos** e **Revendedores** seguindo Padrões DDD (Aggregate Roots, Value Objects, Eventos de Domínio, Ports & Adapters) descritos em `REQUISITOS_KAZA_TEM_SYSTEM.md`.

## Tecnologias centrais

- NestJS 10+ (Fastify adapter, Validation Pipe global, Schedule e EventEmitter)
- MikroORM 6 com driver `@mikro-orm/postgresql`
- Supabase (Autenticação opcional, banco PostgreSQL, Storage)
- Arquitetura Hexagonal: Domain → Application → Infrastructure
- Domain primitives e shared kernel (pacotes locais)

## Estrutura resumida

```
apps/kaza-tem-system/backend/src/
├── contexts/
│   ├── user/
│   ├── product/
│   └── reseller/
├── infrastructure/
│   ├── http/
│   ├── persistence/
│   └── integrations/       # Magis5, Melhor Envio, Cielo, etc.
├── config/
│   └── env.validation.ts
├── app.module.ts
└── main.ts
```

## Configuração inicial

1. **Instale as dependências do monorepo**
   ```bash
   npm install
   ```

2. **Crie a conta e projeto no Supabase**
   - https://supabase.com
   - Salve: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`

3. **Copie o `.env`**
   ```bash
   cd apps/kaza-tem-system/backend
   cp .env.example .env
   ```
   Atualize `DATABASE_URL` e demais chaves (Magis5, Cielo, Melhor Envio, JWT, APP_URL).

4. **Crie a base de dados**
   Supabase já cria o PostgreSQL; use migrations a seguir.

5. **Execute migrations**
   ```bash
   npm run migration:up
   ```

6. **Inicie o backend**
   ```bash
   npm run dev
   ```

   O serviço fica disponível em `http://localhost:3000`.

## Contextos principais

### Usuário
- Entities e VOs de usuário (ID, Email)
- Use cases: cadastro (`CreateUser`), leitura (`GetUser`)
- Controller REST (`POST /users`, `GET /users/:id`)
- JWT e autenticação planejados para etapa seguinte

### Produto
- Domain entity com SKU, preço, estoque, atributos para marketplace e imagens
- Value objects: SKU, Price, Stock
- Use cases: `GetProductById`, `SearchProducts`, `ListProductsForMarketplace`, `CreateProductFromMarketplace`, `UpdateProductFromMarketplace`, `DeactivateProductFromMarketplace`
- Integração Magis5 via API Key posteriormente expõe produtos para o ERP
- Controller REST expõe `GET /products`, `GET /products/:id`, `POST /api/v1/products`, `PATCH /api/v1/products/:id`, `DELETE /api/v1/products/:id`

### Revendedor
- Aggregate com IDs, CPF, link único, status e nível
- VOs: `UniqueLink`, `CPF`, `ResellerLevel`, `ResellerStatus`
- Use cases: `RegisterReseller`, `ApproveResellerRegistration`
- Controller REST cobre cadastro e aprovação

## Integrações ativas

- **Magis5 ERP**: API Key protegida expõe os endpoints `/api/v1/products` (listagem, criação, atualização e desativação) e publica webhooks `order.paid` para o ERP. As credenciais são geradas via seed e podem ser regeneradas pelo Admin (`/api/admin/marketplace/*`).
- **Melhor Envio / Cielo**: portas definidas para futuras integrações logísticas e de pagamento.

## Scripts úteis

```bash
# Backend
npm run dev               # Nest em modo watch
npm run build             # Compila
npm run migration:create  # Criar migration
npm run migration:up      # Rodar migrations
npm test                  # Rodar jest
npm run test:cov          # Cobertura
npm run schema:fresh      # Reset completo
```

## API em destaque

- `GET /api/v1/products` — listagem paginada com filtros `page`, `limit` e `updated_since`
- `GET /api/v1/products/:id` — detalhes completos do produto para o Magis5
- `POST /api/v1/products` — cria produto enviado pelo Magis5
- `PATCH /api/v1/products/:id` — atualiza preço, estoque, imagens ou status
- `DELETE /api/v1/products/:id` — marca produto como inativo
- `GET /api/admin/marketplace/config` — retorna status, webhook e total de produtos
- `PUT /api/admin/marketplace/config` — atualiza `webhook_url`
- `POST /api/admin/marketplace/test-webhook` — envia payload de teste
- `POST /api/admin/marketplace/regenerate-credentials` — gera novas credenciais API Key/Secret
- `GET /api/products` — filtros de busca (por nome, categoria, faixa de preço)
- `GET /api/products/:id` — detalhes
- `POST /api/resellers/register` — cria revendedor pendente
- `POST /api/resellers/:id/approve` — aprovação manual

## Próximos passos

1. Implementar autenticação JWT (Supabase Auth ou mecanismo próprio)
2. Criar front-end (Next.js + MUI) em `apps/kaza-tem-system/frontend`
3. Completar integrações (Cielo, Melhor Envio, Magis5)
4. Criar módulos de pedidos, comissões e saques conforme o roadmap

--- 

> Para requisitos completos consulte `REQUISITOS_KAZA_TEM_SYSTEM.md`.
