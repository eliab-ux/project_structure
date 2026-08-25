# CLAUDE_PYTHON.md

Guia para o Claude Code (claude.ai/code) ao desenvolver **aplicações em Python** neste projeto.

> **Este arquivo é um COMPLEMENTO do `CLAUDE.md`, não um substituto.**
> Todas as regras transversais do `CLAUDE.md` continuam **obrigatórias** em Python:
> autenticação **JWT própria** (sem provedores de identidade externos / sem terceiros), Security by Design,
> CORS por env, validação de todo input, segredos só em `.env`, e o **frontend
> Next.js permanece idêntico** ao padrão do `CLAUDE.md`. O `CLAUDE.md` prevalece em
> qualquer conflito. Este arquivo só define **como estruturar o código Python** e
> **como aplicar as mesmas regras com a stack Python**.
>
> **Projeto pessoal e independente.** Nada aqui se conecta a provedores de identidade
> externos ou a qualquer infraestrutura/esquema visual corporativo de terceiros. Cada sistema tem o seu próprio
> esquema de cores e a sua própria identidade.

---

## Comportamento Obrigatório — Leia Antes de Qualquer Coisa

**Claude Code DEVE seguir estas regras em TODO código Python gerado,
sem precisar que o usuário solicite explicitamente:**

1. **Security by Design é inegociável** — vale igual ao `CLAUDE.md`. Aplique os
   padrões de segurança mesmo que o requisito não os mencione.

2. **Todo endpoint (exceto rotas públicas como `/api/health` e a vitrine pública)
   DEVE exigir o usuário autenticado** via `Depends(get_current_user)` — diretamente
   na rota ou no `include_router`. Endpoint protegido sem autenticação é um **bug**,
   salvo comentário explicando o motivo. Para área administrativa/revendedor, use a
   dependência de role correspondente (`require_admin`, `require_reseller`).

3. **Todo schema de request DEVE validar todos os campos** com `pydantic`
   (tipos, `Field(min_length/max_length/ge/le)`, validadores). Nunca aceite `dict`
   cru ou `Any` vindo do cliente.

4. **Toda rota DEVE declarar `response_model`** com um schema Pydantic de resposta.
   **Nunca** retorne um modelo ORM nem um `dict` montado à mão — é o equivalente
   Python de "expor a domain entity". O `response_model` filtra campos sensíveis.

5. **Nunca hardcode secrets** — vão para `.env`/`Settings`. Nova variável → atualizar
   `.env.example` **e** a classe `Settings`.

6. **Erros internos nunca chegam ao cliente** — use o handler global de exceções.
   Mensagem genérica para o cliente; stack/detalhe completo só no log interno.

7. **Se o usuário pedir algo que viola segurança**, implemente de forma segura e
   explique a diferença. Nunca implemente o padrão inseguro.

8. **Alterações de banco** versionadas — **Alembic** (migrations) é o padrão para apps
   Python, OU scripts SQL idempotentes em `deploy/sql/`. Nunca rode `create_all` em
   produção nem altere o schema manualmente sem deixar o artefato no repositório.

9. **Comunicação em pt-BR; código e identificadores em inglês.** Comentários e docs
   em português; nomes de variáveis, funções, classes, tabelas e colunas em inglês.

---

## Quando usar Python (e quando NÃO usar)

**O padrão do projeto é NestJS + Fastify + MikroORM.** Só use Python quando o
**domínio do problema** justificar, por exemplo:

- ETL pesado de planilhas Excel/CSV (`pandas`, `openpyxl`).
- Processamento de dados / análise numérica / ciência de dados.
- Integração com IA/ML cujo ecossistema é Python (modelos, embeddings, libs científicas).
- Automação que depende de bibliotecas sem equivalente maduro em Node.

**Se for CRUD de negócio comum, API transacional ou tela administrativa → use NestJS.**
Não escolha Python por preferência pessoal; escolha pela natureza do domínio.
Registre a justificativa no `README.md` do serviço.

---

## Stack Python Padrão

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime | **Python 3.12** | `python:3.12-slim` no Docker |
| Web framework | **FastAPI** | equivalente ao NestJS |
| ASGI server | **Uvicorn** (`[standard]`) | `--proxy-headers --forwarded-allow-ips '*'` |
| ORM | **SQLAlchemy 2.0** (estilo tipado `Mapped[]`) | nunca Django ORM |
| Driver DB | **psycopg** (v3) p/ Postgres | banco por projeto — **Supabase** é a sugestão padrão (ver nota) |
| Validação / DTO | **Pydantic v2** | request/response schemas |
| Config | **pydantic-settings** | `Settings` + `get_settings()` cacheado |
| Auth | **PyJWT** + **passlib[bcrypt]** | JWT próprio, mesmo secret do backend NestJS |
| Migrations | **Alembic** | (ou `deploy/sql/` idempotente) |
| Upload | **python-multipart** ou base64 JSON | conforme o endpoint |
| Dados | **pandas**, **openpyxl** | só nos serviços que fazem ETL |
| Testes | **pytest** + **httpx**/`TestClient` | |
| Lint + Format | **ruff** | substitui ESLint + Prettier |
| Type check | **mypy** | modo estrito; equivalente ao `tsc --strict` |

`requirements.txt` fixa versões com `>=` mínimo. Apps novos podem usar `pyproject.toml`,
mas mantenha `requirements.txt` para o Docker build.

---

## Arquitetura — Hexagonal Python

**Nome oficial: Hexagonal Python.** É a irmã Python da arquitetura hexagonal dos apps
NestJS — mesmo modelo mental, para transferir o raciocínio entre os dois ecossistemas.
É **hexagonal pragmática**, não a versão acadêmica "by the book":

- **Inversão de dependência real existe no limite da persistência** — o `service`
  depende de um **port** (`Protocol`), e o repositório concreto SQLAlchemy é o adapter.
  É isso que torna o nome honesto (e não apenas "camadas").
- **Não há port/mapper em toda camada** — só onde o Python mais vaza (persistência).
  Em CRUD anêmico (ETL), o `response_model` separado já isola o ORM do HTTP.
- **As fronteiras são impostas mecanicamente** pelo `import-linter` no CI — em Python
  não há compilador para barrar import errado, então o linter de contratos faz esse papel.
  **Sem o `import-linter`, o nome "hexagonal" é só promessa**: é ele que impede a erosão
  das camadas ao longo das edições feitas por IA.

A regra essencial é a mesma do `CLAUDE.md`: **dependências apontam para dentro**, o
domínio é puro, e a infraestrutura (HTTP, banco, Excel, IA) fica nas bordas.

### Estrutura de pastas obrigatória (`backend/app/`)

```
backend/
├── app/
│   ├── core/                 # Transversal: config, security, exceptions, logging
│   │   ├── config.py         # Settings (pydantic-settings) + get_settings()
│   │   ├── security.py       # JWT próprio: decode_token, token_to_user, hash/verify senha
│   │   ├── exceptions.py     # Exceções de negócio tipadas (DomainError, NotFound...)
│   │   └── logging.py        # Config de logging (sem dados sensíveis)
│   │
│   ├── api/                  # ADAPTER HTTP (controllers finos)
│   │   ├── deps/
│   │   │   ├── auth.py        # get_current_user / require_admin / require_reseller
│   │   │   └── db.py          # get_db (sessão por request)
│   │   └── routes/
│   │       ├── health.py      # público
│   │       └── <recurso>.py   # 1 router por recurso; SÓ chama services
│   │
│   ├── schemas/              # DTOs Pydantic — FRONTEIRA da aplicação
│   │   ├── <recurso>.py       # *Request e *Response (validação + serialização)
│   │   └── health.py
│   │
│   ├── services/             # CAMADA DE APLICAÇÃO (use cases / orquestração)
│   │   └── <recurso>_service.py
│   │
│   ├── repositories/         # ADAPTER DE PERSISTÊNCIA (encapsula SQLAlchemy)
│   │   └── <recurso>_repository.py
│   │
│   ├── domain/               # REGRAS DE NEGÓCIO PURAS (zero framework)
│   │   └── <regra>.py         # funções/dataclasses puras
│   │
│   ├── models/               # ORM ENTITIES SQLAlchemy
│   │   ├── base.py            # DeclarativeBase
│   │   └── <recurso>.py
│   │
│   ├── integrations/         # ADAPTERS EXTERNOS (Excel, REST de terceiros, IA, Supabase)
│   │   └── excel_importer.py
│   │
│   └── main.py               # Bootstrap FastAPI (CORS, Swagger, routers, lifespan)
│
├── tests/                    # pytest (unit + integration + api)
├── alembic/                  # migrations (ou deploy/sql/ idempotente)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt          # (ou pyproject.toml)
├── pyproject.toml            # config ruff + mypy + pytest + import-linter
├── .env.example
└── .dockerignore
```

### Mapeamento com a arquitetura NestJS do `CLAUDE.md`

| Conceito (CLAUDE.md / NestJS) | Equivalente Python (este arquivo) |
|---|---|
| Controller | `api/routes/<recurso>.py` |
| `JwtAuthGuard` | `api/deps/auth.py` → `get_current_user` |
| `AdminGuard` / `ResellerGuard` | `api/deps/auth.py` → `require_admin` / `require_reseller` |
| Request/Response DTO | `schemas/<recurso>.py` (Pydantic) |
| Use Case | função em `services/<recurso>_service.py` |
| Repository Port (interface) | `Protocol` em `repositories/<recurso>_repository.py` |
| Repository impl. + DI por Symbol | classe concreta + `Depends(get_..._repository)` |
| Domain Entity / Value Object / regra | `domain/` (funções/dataclasses puras) |
| ORM Entity (`-orm.entity.ts`) | `models/<recurso>.py` (SQLAlchemy) |
| `UnitOfWorkPort` | a própria `Session` do SQLAlchemy (commit no service) |
| `GlobalExceptionFilter` | `@app.exception_handler(...)` em `main.py` |
| `env.validation.ts` | `core/config.py` (`Settings` valida no startup) |

### Regra de dependência (direção do fluxo)

```
api/routes  →  services  →  repositories  →  models   (ORM/SQLAlchemy)
                   │
                   └──────→  domain   (regras puras, SEM imports de framework)
```

**Proibido (gera revisão reprovada):**
- `routes` importar `models`, `Session` ou montar query — rota só conhece schemas e services.
- `domain/` importar `fastapi`, `sqlalchemy`, `psycopg`, `pandas` ou qualquer modelo ORM.
- `services` montar resposta HTTP (status code, `HTTPException` de apresentação).
  Serviço lança exceção **de negócio** (`core/exceptions.py`); a rota/handler traduz.
- `repositories` fazer `commit()` — quem controla a transação é o **service** (Unit of Work).

---

## Camada por Camada — Regras e Exemplos

### 1. `core/config.py` — Settings

`pydantic-settings`, instância única cacheada.

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MyService"
    environment: str = "development"     # development | production
    port: int = 8000
    root_path: str = ""                  # prefixo atrás do proxy (ex: /myservice)

    # Auth própria — MESMO secret do backend NestJS (tokens interoperáveis)
    jwt_access_secret: str = ""
    jwt_refresh_secret: str = ""

    # PostgreSQL / Supabase
    database_url: str = ""               # postgresql+psycopg://user:pass@host:5432/postgres

    # Supabase (storage / clientes)
    supabase_url: str = ""
    supabase_service_role_key: str = ""  # secret

    cors_origins: str = "http://localhost:3003"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

| Ambiente | `ENVIRONMENT` | Swagger |
|---|---|---|
| Dev local | `development` | ✅ |
| Produção | `production` | ❌ |

> `is_production = settings.environment == "production"`.

### 2. `core/security.py` — JWT próprio + senha

O JWT é **próprio** (sem terceiros). Para que os tokens emitidos pelo backend NestJS
sejam aceitos por este serviço Python (e vice-versa), use o **mesmo algoritmo (HS256) e
o mesmo secret** (`JWT_ACCESS_SECRET`). Os claims seguem o `AuthTokenPayload` do
`CLAUDE.md` (`sub`, `role`, `resellerId`).

```python
import jwt
from passlib.context import CryptContext
from app.core.config import get_settings
from app.core.exceptions import TokenError

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthenticatedUser:
    def __init__(self, sub: str, role: str, reseller_id: str | None = None) -> None:
        self.sub = sub
        self.role = role
        self.reseller_id = reseller_id


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_settings().jwt_access_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


def token_to_user(payload: dict) -> AuthenticatedUser:
    return AuthenticatedUser(
        sub=payload["sub"],
        role=payload.get("role", "customer"),
        reseller_id=payload.get("resellerId"),
    )


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)
```

### 3. `api/deps/auth.py` — autenticação e roles

`HTTPBearer` faz o botão **Authorize** do Swagger funcionar nativamente.

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import AuthenticatedUser, decode_token, token_to_user
from app.core.exceptions import TokenError

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(401, "Missing Authorization header", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = decode_token(credentials.credentials)
    except TokenError:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return token_to_user(payload)


def require_admin(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "admin":
        raise HTTPException(403, "Acesso restrito a administradores")
    return user


def require_reseller(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    if user.role != "reseller" or not user.reseller_id:
        raise HTTPException(403, "Acesso restrito a revendedores")
    return user
```

### 4. `api/deps/db.py` — `get_db` (sessão por request)

```python
from collections.abc import Generator
from sqlalchemy.orm import Session
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 5. `models/` — ORM Entities (SQLAlchemy 2.0 tipado, PostgreSQL)

```python
# models/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

# models/product.py
from datetime import datetime, UTC
from uuid import uuid4
from sqlalchemy import String, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Product(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), index=True)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
```

**Regras:**
- SQLAlchemy 2.0 estilo `Mapped[]` / `mapped_column` (nunca o estilo legado `Column`).
- `datetime.now(UTC)` — **nunca** `datetime.utcnow()` (deprecado no 3.12).
- O DDL real vive no Alembic ou em `deploy/sql/`. **Nunca** `create_all` em produção.

### 6. `schemas/` — DTOs Pydantic (request + response)

Esta é a fronteira. **Todo request validado, toda resposta com schema.**

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class UpdateProductRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: float | None = Field(default=None, ge=0)

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # lê direto do modelo ORM
    id: str
    name: str
    price: float | None
    created_at: datetime
    # campos sensíveis NUNCA aparecem aqui (ausência intencional = não vaza)
```

Use `ConfigDict(from_attributes=True)` + `response_model` e deixe o Pydantic serializar —
**nunca** monte `dict` à mão.

### 7. `repositories/` — Persistência com Port (a inversão de dependência)

Encapsula o acesso a dados. **Não faz commit** (a transação é do service). O service
depende do **port** (`Protocol`), não da classe concreta — equivalente do
`UserRepositoryPort` + Symbol do NestJS.

```python
from typing import Protocol
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.product import Product


class ProductRepositoryPort(Protocol):
    def find_by_id(self, product_id: str) -> Product | None: ...
    def list_paginated(self, page: int, limit: int) -> tuple[list[Product], int]: ...
    def add(self, product: Product) -> Product: ...


class ProductRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def find_by_id(self, product_id: str) -> Product | None:
        return self._db.get(Product, product_id)

    def list_paginated(self, page: int, limit: int) -> tuple[list[Product], int]:
        offset = (page - 1) * limit
        items = list(self._db.scalars(select(Product).limit(limit).offset(offset)))
        total = self._db.scalar(select(func.count()).select_from(Product)) or 0
        return items, total

    def add(self, product: Product) -> Product:
        self._db.add(product)
        self._db.flush()   # gera ID/erros; commit fica no service
        return product
```

```python
# api/deps/repositories.py
def get_product_repository(db: Session = Depends(get_db)) -> ProductRepositoryPort:
    return ProductRepository(db)
```

### 8. `services/` — Camada de Aplicação (Use Cases)

Orquestra domínio + repositórios. **Controla a transação (Unit of Work).** Lança
exceções de negócio tipadas (`core/exceptions.py`), nunca `HTTPException`.

```python
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, BusinessRuleError
from app.repositories.product_repository import ProductRepository
from app.domain.product_rules import is_valid_price

def update_product(db: Session, product_id: str, name: str, price: float | None) -> Product:
    if price is not None and not is_valid_price(price):     # regra de domínio
        raise BusinessRuleError("Preço inválido.")
    repo = ProductRepository(db)
    product = repo.find_by_id(product_id)
    if product is None:
        raise NotFoundError("Produto não encontrado.")
    product.name = name
    product.price = price
    db.commit()                                             # Unit of Work: commit aqui
    db.refresh(product)
    return product
```

### 9. `domain/` — Regras puras

Funções/dataclasses sem nenhum import de framework. Testáveis isoladamente.

```python
# domain/product_rules.py  (ZERO imports de fastapi/sqlalchemy/pandas)
def is_valid_price(price: float) -> bool:
    return price >= 0
```

### 10. `api/routes/` — Controllers finos

Só validam entrada (via schema), chamam o service e devolvem o `response_model`.
Sem lógica de negócio, sem `try/except` repetido — o handler global trata os erros.

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps.db import get_db
from app.schemas.product import UpdateProductRequest, ProductResponse
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: str, payload: UpdateProductRequest, db: Session = Depends(get_db)):
    return product_service.update_product(db, product_id, payload.name, payload.price)
    # NotFoundError → 404, BusinessRuleError → 400: traduzidos pelo handler global
```

### 11. `main.py` — Bootstrap

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import get_settings
from app.core.exceptions import BusinessRuleError, NotFoundError

settings = get_settings()
is_production = settings.environment == "production"

app = FastAPI(
    title=f"{settings.app_name} API",
    root_path=settings.root_path,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handlers (= GlobalExceptionFilter): negócio → status correto; resto → 500 genérico
@app.exception_handler(NotFoundError)
async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"message": str(exc)})

@app.exception_handler(BusinessRuleError)
async def _bad_request(_: Request, exc: BusinessRuleError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"message": str(exc)})

@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception em %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"message": "Erro interno. Tente novamente."})

app.include_router(health_router, prefix="/api")                          # público
auth = [Depends(get_current_user)]                                        # = JwtAuthGuard
app.include_router(product_router, prefix="/api", dependencies=auth)      # protegido
```

---

## Security by Design em Python (os 6 princípios do CLAUDE.md)

| Princípio (CLAUDE.md) | Como aplicar em Python |
|---|---|
| 1. Minimize superfície | `response_model` em toda rota; só os campos necessários no schema de saída. |
| 2. Never trust input | Schema Pydantic valida o request (camada 1); `domain/` valida invariantes (camada 2). |
| 3. Fail securely | Handler global: cliente recebe mensagem genérica; stack só no log. |
| 4. Defense in depth | CORS → `get_current_user` → validação Pydantic → service → domain → ORM parametrizado. |
| 5. Menor privilégio | Service recebe só o repositório que precisa; revendedor só acessa o próprio `reseller_id`. |
| 6. Isolamento | `domain/` sem dependências externas; secrets só em `Settings`/`.env`. |

**Regras absolutas (nunca violadas) — versão Python:**

```
❌ Hardcodar secrets/senhas/tokens no código
❌ Logar dados sensíveis (senha, token, CPF, cartão)   →  logging estruturado sem esses campos
❌ Retornar stack trace ou mensagem de ORM ao cliente
❌ Endpoint protegido sem Depends(get_current_user) sem comentário documentando
❌ Campo de request sem validação Pydantic
❌ Retornar modelo ORM ou dict cru via HTTP (sempre response_model com schema)
❌ Usar Any em dado vindo de fora (HTTP, banco, Excel, evento externo)
❌ Montar SQL por concatenação de string  →  sempre via SQLAlchemy (queries parametrizadas)
❌ Nova env var sem atualizar .env.example e Settings
❌ Qualquer dependência/URL/fluxo ligado a provedores de identidade externos
```

---

## Banco de Dados — Regras

> **Escolha do banco é por projeto.** O **Supabase (PostgreSQL gerenciado)** é a
> **sugestão padrão**, mas cada serviço pode usar outro banco. Ao trocar, ajuste o
> dialeto/driver no `DATABASE_URL` e a engine; o resto (port de repositório, service,
> Unit of Work) permanece igual.

- **PostgreSQL (Supabase)** via `DATABASE_URL` (`postgresql+psycopg://...`).
- **Migrations versionadas com Alembic** (padrão), ou scripts SQL idempotentes
  (`IF NOT EXISTS`) em `deploy/sql/NN_descricao.sql`. **Nunca** `create_all` em produção.
- `init_db()` só roda `create_all` em fallback SQLite de teste — nunca quando
  `DATABASE_URL` aponta para o Postgres real.
- **Transação = Unit of Work no service.** `commit()` só no service; repositório usa `flush()`.
- **Engine** com `pool_pre_ping=True`, `pool_recycle` adequado para o pgbouncer do Supabase.

```python
# db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings

engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_recycle=280)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
```

> **Supabase + pgbouncer:** ao usar o pooler em modo *transaction*, desabilite prepared
> statements no driver (`prepare_threshold=None` no psycopg) para evitar erros de cache.

---

## Swagger (FastAPI)

- **Nativo do FastAPI**, em `/docs`, **desligado em produção** (`docs_url=None` quando
  `is_production`). Sem `/api/docs`, sem `/swagger`.
- O botão **Authorize** funciona nativamente via `HTTPBearer` — basta colar o JWT.
- **`root_path=settings.root_path`** (ex: `/myservice`) faz o Swagger gerar URLs com o
  prefixo correto atrás de um proxy reverso.

---

## CORS

Idêntico ao `CLAUDE.md`: `CORSMiddleware` com `allow_origins=settings.cors_origin_list`
(lido de `CORS_ORIGINS`). Nunca `*` com credenciais em produção. Origem de dev típica:
`http://localhost:3003` (frontend Next.js).

---

## Error Reporting — Port de Monitoramento (preparação para um Guard próprio)

> Haverá uma ferramenta **própria** de captura de cenários de erro (um "Guard" com nome
> a definir — **`<NomeDoGuard>`**). **É uma ferramenta própria, sem vínculo com terceiros.** O serviço Python deve **já
> nascer preparado** para plugá-la, exatamente como o backend NestJS (ver `CLAUDE.md`).

Implemente um **port** em `core/error_reporter.py` — fire-and-forget, à prova de falha
própria, **no-op quando não configurado**. A captura acontece no ponto único equivalente
ao `GlobalExceptionFilter`: o `@app.exception_handler(Exception)`.

```python
# app/core/error_reporter.py — port (fire-and-forget; jamais bloqueia ou propaga erro próprio)
from __future__ import annotations
import hashlib, logging, traceback
from datetime import UTC, datetime
from typing import Any
import httpx
from app.core.config import get_settings

logger = logging.getLogger(__name__)
_SENSITIVE = {"authorization", "password", "senha", "token", "secret", "cpf", "api_key"}


def _sanitize(ctx: dict[str, Any]) -> dict[str, Any]:
    return {k: ("***" if k.lower() in _SENSITIVE else v) for k, v in ctx.items()}


def _fingerprint(exc: Exception, path: str) -> str:
    base = f"{type(exc).__name__}|{path}|{str(exc)[:200]}"
    return hashlib.sha256(base.encode()).hexdigest()[:32]


async def report_exception(exc: Exception, *, method: str, path: str,
                           context: dict[str, Any] | None = None) -> None:
    """Envia o cenário ao <NomeDoGuard>. NUNCA levanta exceção."""
    s = get_settings()
    if not s.error_reporter_url or not s.error_reporter_api_key:
        return  # sem ferramenta configurada → no-op (ex.: dev local)
    try:
        payload = {
            "app": s.app_name, "environment": s.environment,
            "fingerprint": _fingerprint(exc, path),
            "exceptionType": type(exc).__name__, "message": str(exc)[:1000],
            "stack": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[:8000],
            "method": method, "path": path, "context": _sanitize(context or {}),
            "occurredAt": datetime.now(UTC).isoformat(),
        }
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(s.error_reporter_url, json=payload,
                              headers={"X-Ingest-Api-Key": s.error_reporter_api_key})
    except Exception:  # noqa: BLE001 — reportar erro JAMAIS pode gerar novo erro
        logger.debug("Falha ao reportar exceção ao Guard (ignorada).", exc_info=True)
```

Disparo **não-bloqueante** via `BackgroundTask` no handler global (a resposta 500 não
espera o envio). **Só reporta 500 / exceções inesperadas** — nunca `NotFoundError`,
`BusinessRuleError`, validação ou 4xx esperado.

```python
from starlette.background import BackgroundTask
from app.core.error_reporter import report_exception

@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception em %s %s", request.method, request.url.path, exc_info=exc)
    task = BackgroundTask(report_exception, exc, method=request.method, path=request.url.path,
                          context={"client": request.client.host if request.client else None})
    return JSONResponse(500, {"message": "Erro interno. Tente novamente."}, background=task)
```

```python
# core/config.py — acrescentar ao Settings (vazio = no-op)
error_reporter_url: str = ""
error_reporter_api_key: str = ""
```

```env
# .env.example — deixe vazio em dev local para não reportar
ERROR_REPORTER_URL=
ERROR_REPORTER_API_KEY=
```

---

## Deploy (Docker)

Publicação por Docker (genérico — sem infraestrutura de terceiros). O frontend continua
Next.js no padrão do `CLAUDE.md`. O que muda é só o conteúdo do Dockerfile (Python).

### Dockerfile (PostgreSQL)

```dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN useradd --create-home --shell /usr/sbin/nologin appuser
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
# Healthcheck em 127.0.0.1 (não localhost — IPv6 quebra em slim)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import json,urllib.request; raise SystemExit(0 if json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=5)).get('status')=='ok' else 1)"
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers","--forwarded-allow-ips","*"]
```

### `.env.example` (campos mínimos)

```env
APP_NAME=MyService
ENVIRONMENT=development
PORT=8000
ROOT_PATH=

# Auth — MESMO secret do backend NestJS (tokens interoperáveis)
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# PostgreSQL / Supabase
DATABASE_URL=postgresql+psycopg://user:password@host:5432/postgres
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

CORS_ORIGINS=http://localhost:3003
```

---

## Qualidade de Código

- **`ruff`** para lint + format (substitui ESLint + Prettier). Rodar `ruff check` e `ruff format`.
- **`mypy`** em modo estrito — sem `Any` em dados externos; type hints em tudo.
- **`import-linter`** para impor as fronteiras de camada no CI. **Esta é a peça que
  protege a arquitetura ao longo das edições** — sem ela, as camadas erodem.
- **Identificadores em inglês**, comentários/docs em pt-BR.
- **`datetime.now(UTC)`** sempre; nunca `utcnow()`.
- **Sem `print`** — use `logging`.
- **Teto de tamanho (gatilho de split):** arquivo de `service`/`repository` acima de
  **~150 linhas**, ou função acima de **~50 linhas**, deve ser **dividido**. Prefira
  **um arquivo por operação** (fatiamento vertical) a um service monolítico.

### `import-linter` — fronteiras impostas mecanicamente

```toml
# pyproject.toml — seção [tool.importlinter]
[importlinter]
root_package = "app"

[[importlinter.contracts]]
name = "Camadas apontam para dentro (routes -> services -> repositories/domain -> models)"
type = "layers"
layers = ["app.api", "app.services", "app.repositories", "app.models"]

[[importlinter.contracts]]
name = "Domínio é puro (sem framework nem infraestrutura)"
type = "forbidden"
source_modules = ["app.domain"]
forbidden_modules = ["fastapi", "sqlalchemy", "psycopg", "pandas", "httpx",
                     "app.models", "app.repositories", "app.api"]

[[importlinter.contracts]]
name = "Rotas não acessam persistência diretamente"
type = "forbidden"
source_modules = ["app.api.routes"]
forbidden_modules = ["app.models", "sqlalchemy"]
```

```toml
[tool.ruff]
line-length = 110
target-version = "py312"
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.12"
strict = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

> Rodar `lint-imports` no CI junto de `ruff check`, `mypy` e `pytest`. Qualquer violação
> reprova o merge — é o que mantém a "Hexagonal Python" honesta na prática.

---

## Testes (pytest)

- **`tests/unit/`** — `domain/` e regras puras (sem banco, sem rede). Cobertura alta aqui.
- **`tests/integration/`** — repositories/services com sessão transacional revertida.
- **`tests/api/`** — `TestClient`/`httpx` no ciclo HTTP completo (auth, status, payload).

**Sempre testar autenticação:** health público sem token = 200; rota protegida sem
token = 401; token inválido = 401; token assinado com o `JWT_ACCESS_SECRET` correto ≠ 401;
rota admin com token de role `customer` = 403.

---

## Checklist — Novo Serviço Python

- [ ] Justificativa de usar Python registrada no `README.md` do serviço
- [ ] Estrutura `app/{core,api,schemas,services,repositories,domain,models,integrations}` criada
- [ ] `core/config.py` com `Settings` + `get_settings()` cacheado; novas envs no `.env.example`
- [ ] `core/security.py` = JWT próprio (mesmo secret do NestJS) + hash/verify de senha
- [ ] `api/deps/auth.py` (`get_current_user`, `require_admin`, `require_reseller`) e `api/deps/db.py`
- [ ] `/api/health` público; demais routers protegidos por `Depends(get_current_user)`
- [ ] Todo request com schema Pydantic validado; toda rota com `response_model`
- [ ] Repositório expõe **port (`Protocol`)**; service depende do port, não da classe concreta
- [ ] `core/exceptions.py` + handlers globais em `main.py` (negócio → status; resto → 500 genérico)
- [ ] **`core/error_reporter.py` (port do Guard de monitoramento)** + handler global reportando 500 em segundo plano (no-op quando não configurado)
- [ ] **`import-linter` configurado** e rodando no CI (`lint-imports`)
- [ ] CORS por `CORS_ORIGINS`; Swagger só fora de produção; `root_path` configurado
- [ ] Migrations versionadas (Alembic) ou `deploy/sql/` idempotente; nenhum `create_all` em produção
- [ ] Dockerfile (usuário não-root, healthcheck `127.0.0.1`)
- [ ] Frontend no padrão do `CLAUDE.md` (Next.js, auth própria) — sem mudanças
- [ ] `ruff` + `mypy` + `lint-imports` sem erros; testes de auth + domínio passando

## Checklist — Security by Design (validação final)

- [ ] Todo endpoint protegido por `get_current_user` (ou comentário justificando exceção)
- [ ] Todo campo de request validado por Pydantic
- [ ] `response_model` em toda rota; nenhum campo sensível no schema de saída
- [ ] Nenhum modelo ORM nem `dict` cru retornado via HTTP
- [ ] Nenhum secret hardcodado; envs novas no `.env.example` + `Settings`
- [ ] Logs sem dados sensíveis; erros internos não vazam ao cliente
- [ ] Queries só via SQLAlchemy (sem string SQL concatenada)
- [ ] Nenhuma dependência/URL ligada a provedores de identidade externos

---

## Pitfalls Comuns (evitar)

1. ❌ Reimplementar validação de JWT divergente do backend NestJS — use o **mesmo secret/algoritmo (HS256)**.
2. ❌ Retornar `dict` montado à mão — use `response_model` + `ConfigDict(from_attributes=True)`.
3. ❌ `HTTPException` dentro de service — lance exceção de negócio, deixe o handler traduzir.
4. ❌ `commit()` em repositório — commit é do service (Unit of Work).
5. ❌ `routes` importando `models`/`Session` — rota só conhece schemas e services.
6. ❌ `domain/` importando `fastapi`/`sqlalchemy`/`pandas` — domínio é puro.
7. ❌ `datetime.utcnow()` — use `datetime.now(UTC)`.
8. ❌ `create_all`/DDL automático em produção — DDL só via Alembic ou `deploy/sql/` idempotente.
9. ❌ `localhost` no healthcheck — use `127.0.0.1` (IPv6 quebra em slim).
10. ❌ `Any` em dado externo — tipar com Pydantic/`mypy strict`.
11. ❌ Service dependendo da classe concreta de repositório — dependa do `Protocol` (port).
12. ❌ Confiar só neste arquivo sem o `import-linter` — sem ele as camadas erodem.
13. ❌ Qualquer dependência ligada a provedores de identidade externos.
14. ❌ Esquecer de desabilitar prepared statements ao usar o pooler do Supabase (transaction mode).

---

## Referência

- **Regras transversais, auth própria, frontend e deploy:** `CLAUDE.md` (prevalece em conflito).
- **Stack do projeto:** NestJS + PostgreSQL/Supabase; Python só quando o domínio justificar.
