# 01_Veertex_Core.md — Módulo CORE (Fundação)

> Leitura prévia obrigatória: `00_Veertex_Visao_Geral.md` + `CLAUDE.md` do monorepo.
> O CORE é sempre ativo (não desativável). Tudo aqui é pré-requisito dos demais módulos.

## 1. Objetivo

Fornecer a fundação multi-tenant do Veertex: conta (tenant), empresas (CNPJs), usuários
com papéis e permissões granulares, cadastro unificado de contatos, cadastro de
produtos (com kit comercial), campos personalizáveis (`field_config`), catálogo e
ativação de módulos, e o dashboard inicial.

## 2. Papéis envolvidos

- **Dono da conta / Admin:** configura empresas, usuários, módulos, campos.
- **Gestor:** cadastros do dia a dia (contatos, produtos), relatórios.
- **Demais papéis** (operador, representante, gerente, contador): consumidores do CORE —
  criados aqui, exercidos nos módulos.

## 3. Entidades e regras de negócio

### 3.1 Account (conta/tenant)
- Identidade do cliente do Veertex. Plano define teto de módulos (`plan.limits` jsonb).
- Status: `active | suspended | cancelled`. Cancelamento em etapas com exportação
  prévia dos dados (padrão Bling — nunca prender dados).
- **Toda tabela de negócio do sistema carrega `account_id` NOT NULL indexado** (pool
  model; RLS por `account_id`; ver Visão Geral §3).

### 3.2 Company (empresa/CNPJ)
- N empresas por conta, **sem hierarquia matriz/filial** (paralelas).
- Campos fiscais: razão social, fantasia, CNPJ, IE (+isento), IM, Suframa, CNAE,
  **regime tributário** (`simples | normal | mei`), endereço completo, e-mails
  (contato e cobrança separados), logo. IEs de substituto tributário por UF (lista).
- **Estoque, numeração fiscal e emissão são POR empresa** (segregados). Transferência
  entre empresas = operação fiscal (módulo EST/FIS). **Empresa é dimensão analítica
  obrigatória em todo relatório** (filtro + comparativo).
- Certificado digital A1 por empresa (upload pfx/p12, senha cifrada, validade exibida) —
  armazenado cifrado; consumido pelo FIS.

### 3.3 User + Role (usuários e papéis)
- **Regra do CLAUDE.md (inegociável): nome, e-mail e WhatsApp obrigatórios**
  (`PhoneE164` como VO; coluna NOT NULL; recuperação de senha por código no WhatsApp).
- Auth JWT próprio (access+refresh), bcrypt. Guards: `JwtAuthGuard` + guards de papel +
  `@RequireModule('<code>')` em todo controller de módulo opcional.
- **Papéis com permissões granulares** (referência Bling): árvore por área com
  sub-permissões finas (ex.: `contacts.credit_limit.edit`, `products.price.edit`,
  `reports.export`), separando leitura/inclusão-edição/exclusão. Estrutura:
  `role.permissions` jsonb `{ "área": ["permissões"] }` + helper de checagem central.
- Papéis padrão seed: Admin, Gestor, Gerente, Operador de Caixa, Representante,
  Entregador, Contador (ajustáveis por conta).
- Controle de horários de acesso (janelas por dia da semana), global e por usuário
  (referência Bling) — **fase 2 do CORE; deixar o modelo preparado, UI depois**.
- Vendedor comercial: atributos de comissão vivem no user (modelo A/B, escalas,
  % — detalhados em `02_Veertex_Vnd.md`), além de `price_list_id` e regra comercial
  (rota) em `04_Veertex_Rot.md`.

### 3.4 Contact (contatos unificados — DECISÃO fechada)
- **Um cadastro único com TIPOS múltiplos:** `customer | supplier | carrier | reseller`
  (checkboxes — o mesmo contato pode ser vários). Modelo Bling.
- Pessoa: `individual | company` (CPF/CNPJ; validação de dígitos; unicidade por conta
  configurável — "permitir CPF/CNPJ duplicado" é preferência da conta).
- Campos base: nome/razão, fantasia, documentos (CPF/CNPJ/IE/IM), e-mails, telefones,
  endereços N (`main | billing | delivery`) com lat/lng (geocodificação assíncrona
  via BullMQ ao salvar endereço — best effort).
- Campos comerciais: limite de crédito (**bloqueia venda acima — módulos VND/COB
  aplicam**), tabela de preço, vendedor vinculado ("contato acessível somente ao
  vendedor vinculado" = preferência de carteirização), observações.
- Campos do tipo `reseller` (rota): % de comissão individual do revendedor, rota/região,
  representante da carteira (detalhe em `04_Veertex_Rot.md`).
- Código do contato: manual ou sequencial (preferência + próximo número).
- **Campos opcionais governados por `field_config`** (Suframa, GLN, Pix, redes sociais,
  inscrição municipal, etc. — colunas reais nullable; ver §3.6).

### 3.5 Product (produtos + kit)
- Cabeçalho: nome, SKU (manual/sequencial), **formato** `simple | bundle` (variação =
  fase 2, requerida antes do CAN completo — deixar enum aberto), **tipo**
  `product | service`, situação, unidade, condição (`new|used`), preço de venda base.
- Abas/blocos (referência Bling absorvida no levantamento):
  - **Características:** marca, categoria (árvore), tags, produção própria/terceiros,
    validade, pesos/dimensões/volumes/itens por caixa (**obrigatórios p/ cotação de
    frete — widget "validação do produto" indica completude por finalidade**),
    GTIN/EAN + GTIN tributável, DUN-14 (código×qtd caixa), descrições curta/longa,
    link, vídeo.
  - **Imagens:** múltiplas, MinIO, ordenação.
  - **Estoque (parâmetros):** mínimo/máximo, localização física; SALDO vive no EST.
  - **Fornecedores:** N por produto (fornecedor, descrição no fornecedor, código no
    fornecedor, custo, padrão) — insumo da cotação de compras (CMP futuro) e da
    calculadora de precificação.
  - **Tributação:** origem, NCM, CEST, tipo do item, % tributos (IBPT), **grupo de
    produtos para herança fiscal**, blocos ICMS-ST/IPI/PIS-COFINS. Regra: o grosso da
    regra fiscal vem da NATUREZA DE OPERAÇÃO + grupo (FIS); o produto complementa.
    **CFOP NÃO é campo de configuração global** (erro do Nexo a não repetir): deriva
    de natureza de operação × contexto.
- **Kit (`bundle`):** composição comercial de N produtos com quantidades e preço do
  conjunto; montagem SIMPLES (referência SuasVendas). Estoque do kit deriva dos
  componentes (baixa componentes ao vender). **Kit ≠ ficha técnica** (produção é outro
  módulo, invisível aqui).
- Custo médio mantido pelo EST; exibido aqui somente leitura.

### 3.6 FieldConfig (Personalizar Campos)
- `account_id + entity + field` → `visible`, `required`, `label`, `order`.
- Aplicação: backend valida `required` dinamicamente nos DTOs (pipe/validator custom);
  frontend monta formulários lendo a config. Entidades cobertas na V1: `contact`,
  `product`, `order` (order consome em `02`).
- Catálogo de campos por entidade é FIXO em código (colunas reais); a config só governa
  exibição/obrigatoriedade — **nunca cria campo novo**.

### 3.7 Module + AccountModule (modularidade)
- `module` (seed): código, nome, `depends_on[]`, `core` boolean. Dependências:
  COB→FIN; ROT/PDV→EST; CAN→VND+EST; FUNIL→CRM (futuros).
- `account_module`: ativação por conta com validação de dependência e de plano.
- Guard `@RequireModule` (403 se inativo). Menu/rotas do frontend derivam de
  plano ∩ conta ∩ papel. Desativar preserva dados.

### 3.8 Dashboard (V1 mínima)
- Cards: vendas do período, contas a receber/pagar próximos 7 dias (FIN), pedidos por
  origem, top produtos. **Filtro por empresa (CNPJ) + comparativo entre empresas** já
  na V1 (requisito transversal do Eliab).

## 4. Casos de uso (application layer — nomes indicativos)

`CreateAccount` (onboarding: conta + 1ª empresa + admin + módulos do plano/segmento) ·
`UpdateCompany` / `UploadCompanyCertificate` · `InviteUser` / `AssignRole` ·
`UpsertContact` (valida tipos/documentos/limite) · `UpsertProduct` /
`AssembleBundle` · `SetFieldConfig` · `ToggleModule` (valida dependências) ·
`GetDashboard(companyFilter)`.

## 5. Telas (frontend V1)

Configurações (empresa[s], usuários/papéis, campos, módulos com toggles e dependências
visíveis) · Contatos (lista com filtros por tipo + form dinâmico por field_config) ·
Produtos (lista + form em abas + montagem de kit + widget de completude) · Dashboard.

## 6. Integrações do CORE

Geocodificação de endereço (provider port; job BullMQ) · WhatsApp p/ código de
recuperação de senha (engine de notificação mínima — nasce aqui como port
`NotificationPort` com adapter WhatsApp/e-mail; COM completo é módulo futuro) ·
consulta CNPJ p/ auto-preenchimento de contato/empresa (provider port; fase 1.1).

## 7. Critérios de aceite

1. Conta nova via onboarding operável em <5 min (empresa, admin, módulos por segmento).
2. RLS ativo: query sem contexto de conta não retorna dados (teste de integração
   obrigatório); usuário runtime sem DDL/TRUNCATE.
3. Usuário sem WhatsApp não é criável (nas 3 camadas); recuperação por código WhatsApp
   funcional.
4. Módulo desativado → 403 no endpoint a partir da renovação do token, que o `ToggleModule` força
   para os usuários da conta; item some do menu; reativar restaura tudo.
   <!-- Emendado em 10/08/2026 com aprovação do Eliab. Redação anterior: "Módulo desativado → 403
        no endpoint + item some do menu; reativar restaura tudo." O acréscimo ("a partir da
        renovação do token") registra a consequência da decisão do ADR-0001: os módulos efetivos
        viajam no JWT porque guards rodam antes da transação que estabelece o escopo do RLS, então
        existe uma janela até a renovação. Sem a emenda, o critério exigiria um 403 imediato, que só
        a Opção B (guard abrindo transação própria) entregaria — e ela foi descartada no ADR. -->

5. `field_config` marca campo obrigatório → API rejeita payload sem ele; form exibe.
6. Contato com 2 tipos (cliente+fornecedor) funciona nos dois fluxos sem duplicar.
7. Kit vendável com baixa nos componentes (validado junto com 02/03).
8. Dashboard filtra e compara por empresa.
9. Zero violações do CLAUDE.md (guards, DTOs validados, ResponseDto, secrets em env,
   migrations versionadas).

## 8. Pendências/decisões deste módulo

- Provider de consulta CNPJ (escolher na implementação).
- Controle de horários: modelo na V1, UI fase 2 (confirmado acima).
- Variações de produto: enum preparado, implementação antes do CAN completo.
