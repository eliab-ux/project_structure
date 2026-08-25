# Requisitos Completos - Sistema Kaza Tem E-commerce com Revendedores

**Data:** Janeiro 2025  
**Arquitetura:** Hexagonal (Ports & Adapters) com DDD  
**Monorepo Base:** GitSpread  
**Target:** Codex AI / Claude Code (VS Code)

---

## ⚠️ INSTRUÇÕES CRÍTICAS PARA A IA (CODEX)

### LEIA ISTO PRIMEIRO - NÃO PULE ESTA SEÇÃO

**DOCUMENTO DE REFERÊNCIA OBRIGATÓRIA:** `/mnt/project/CLAUDE.md`

Este documento (`CLAUDE.md`) contém **TODAS as regras, padrões e convenções** que DEVEM ser seguidas durante o desenvolvimento. É a **FONTE DA VERDADE** absoluta para:

✅ **Backend:**
- Arquitetura Hexagonal (3 camadas: Domain/Application/Infrastructure)
- Padrões DDD (Entities, Value Objects, Domain Events)
- Dependency Injection com Symbols
- Separação Domain Entity ≠ ORM Entity
- Unit of Work pattern
- Mappers bidirecionais
- Controller patterns (um try-catch, status codes corretos)
- Service layer patterns
- Error handling standards
- Strategy pattern para extensibilidade

✅ **Frontend:**
- Estrutura de componentes (funções declaradas, não arrow functions)
- Styled components (um por elemento visual)
- Naming conventions
- HTML semântico obrigatório
- Validação com react-hook-form + yup
- Context API para state management
- Imports com `src/` (nunca relativos)
- Notificações com useSnackbar
- Sem `export default` em componentes
- Zero `any` - tipagem completa

### ORDEM DE PRIORIDADE

Quando houver conflito entre documentos:

**1º CLAUDE.md** ← SEMPRE TEM PRECEDÊNCIA  
**2º REQUISITOS_KAZA_TEM_SYSTEM.md** (este documento) ← Especificações do projeto  
**3º PROJECT_STRUCTURE.md** ← Estrutura de referência

### ANTES DE ESCREVER QUALQUER CÓDIGO

1. **LEIA** `/mnt/project/CLAUDE.md` por completo
2. **IDENTIFIQUE** qual seção se aplica ao que você vai fazer
3. **SIGA** exatamente os padrões especificados
4. **VALIDE** seu código contra os exemplos do CLAUDE.md

### EXEMPLOS DE PADRÕES OBRIGATÓRIOS (do CLAUDE.md)

**❌ ERRADO:**
```typescript
// Arrow function
const MyComponent = () => <div>...</div>;

// Export default
export default MyComponent;

// Inline styles
<span style={{ color: 'red' }}>Erro</span>

// Tipos dentro de função
function MyPage() {
  interface Props { ... }  // ❌ NUNCA
}
```

**✅ CORRETO:**
```typescript
// Função declarada
export function MyComponent() {
  return <div>...</div>;
}

// Named export (sem default)

// Styled component
const ErrorText = styled.span`
  color: ${props => props.theme.palette.error.main};
`;

// Tipos fora da função
interface MyPageProps {
  userId: string;
}

export function MyPage(props: MyPageProps) {
  // ...
}
```

---

## 📋 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Bounded Contexts (DDD)](#4-bounded-contexts-ddd)
5. [Integrações Externas](#5-integrações-externas)
6. [Schemas de Banco de Dados](#6-schemas-de-banco-de-dados)
7. [Fases de Implementação](#7-fases-de-implementação)
8. [Especificações Detalhadas por Context](#8-especificações-detalhadas-por-context)
9. [APIs e Endpoints](#9-apis-e-endpoints)
10. [Regras de Negócio](#10-regras-de-negócio)
11. [Fluxos Completos](#11-fluxos-completos)
12. [Configurações e Variáveis](#12-configurações-e-variáveis)

---

## 1. VISÃO GERAL

### 1.1 Descrição do Sistema

Sistema de e-commerce B2C integrado com programa de afiliados/revendedores. Permite que usuários se tornem revendedores pagos (assinatura mensal) e ganhem comissões sobre vendas realizadas através de seus links únicos.

### 1.2 Características Principais

- **E-commerce completo** com catálogo de produtos
- **Programa de revendedores** com assinatura mensal (Cielo)
- **Sistema de comissionamento** gradual baseado em faturamento
- **Integração total com Bling** (produtos, estoque, pedidos, contas a pagar)
- **Integração com Magis5** para imagens de produtos
- **Cálculo de frete** via Melhor Envio
- **Checkout integrado** com gateway Cielo
- **Rastreamento de leads e conversões**
- **Dashboard de revendedor** com métricas e materiais de marketing
- **Sistema de saques** com aprovação manual
- **Níveis de revendedor** (Bronze, Prata, Ouro) baseados em faturamento anual

### 1.3 Usuários do Sistema

1. **Cliente Final**: Compra produtos no site
2. **Revendedor**: Divulga produtos via link único e recebe comissões
3. **Administrador**: Gerencia sistema, aprova cadastros e saques

---

## 2. DESIGN SYSTEM E IDENTIDADE VISUAL

### 2.1 Referências Visuais

**Inspiração:** Mercado Livre + Amazon
- **Mercado Livre:** Paleta amarela vibrante, cards com sombras sutis, badges de destaque
- **Amazon:** Layout limpo, hierarquia clara, foco em conversão

### 2.2 Paleta de Cores

#### Cores Primárias
```css
--primary-yellow: #FFE600;        /* Amarelo Kaza Tem (inspirado no ML) */
--primary-yellow-dark: #F2C94C;   /* Amarelo escuro para hover */
--primary-blue: #3483FA;          /* Azul para CTAs secundários (ML) */
--primary-orange: #FF6900;        /* Laranja para ofertas/destaques */
```

#### Cores Secundárias
```css
--secondary-green: #00A650;       /* Verde para sucesso/disponível */
--secondary-red: #F23D4F;         /* Vermelho para erros/esgotado */
--secondary-gray: #666666;        /* Cinza para textos secundários */
```

#### Cores Neutras
```css
--neutral-white: #FFFFFF;
--neutral-bg: #F5F5F5;            /* Fundo geral (estilo ML) */
--neutral-card: #FFFFFF;
--neutral-border: #E5E5E5;
--neutral-text: #333333;
--neutral-text-light: #999999;
--neutral-black: #000000;
```

#### Cores de Badge/Destaque
```css
--badge-bronze: #CD7F32;
--badge-silver: #C0C0C0;
--badge-gold: #FFD700;
--badge-free-shipping: #00A650;   /* Frete grátis */
--badge-hot: #FF6900;             /* Oferta quente */
```

### 2.3 Tipografia

```css
/* Fonte Principal */
font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Hierarquia */
--font-size-h1: 28px;
--font-size-h2: 24px;
--font-size-h3: 20px;
--font-size-body: 14px;
--font-size-small: 12px;
--font-size-tiny: 10px;

/* Pesos */
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-bold: 700;
```

### 2.4 Componentes UI (Padrões)

#### Card de Produto (Estilo ML/Amazon)
```tsx
- Imagem grande e centralizada (ratio 1:1)
- Badge de desconto/frete grátis no topo esquerdo
- Título truncado em 2 linhas
- Preço antigo tachado (se houver desconto)
- Preço atual em destaque (fonte grande, bold)
- Parcelamento em fonte menor
- Badge de "12x sem juros" em verde
- Ícone de frete grátis (se aplicável)
- Botão de ação na hover (desktop)
- Sombra sutil em hover
```

#### Barra de Busca (Estilo ML)
```tsx
- Input largo e destacado
- Ícone de lupa à direita
- Background amarelo no botão de buscar
- Sugestões com autocomplete
- Histórico de buscas
```

#### Header (Estilo Amazon/ML)
```tsx
- Fundo amarelo (--primary-yellow)
- Logo à esquerda
- Barra de busca centralizada (desktop) ou full-width (mobile)
- Ícones: Carrinho, Favoritos, Conta
- Badge com quantidade no carrinho
- Menu hambúrguer (mobile)
```

#### Filtros Laterais (Estilo ML)
```tsx
- Sidebar fixa (desktop)
- Drawer modal (mobile)
- Categorias hierárquicas expansíveis
- Filtros de preço com slider
- Checkboxes para múltipla seleção
- Botão "Limpar filtros" no topo
```

#### Checkout (Estilo Amazon)
```tsx
- Stepper horizontal (1. Carrinho → 2. Entrega → 3. Pagamento → 4. Revisão)
- Cards brancos com bordas
- Resumo do pedido fixo à direita
- Botão verde "Finalizar Compra"
```

### 2.5 Layout Patterns

#### Homepage
```
┌─────────────────────────────────────────┐
│ Header (Amarelo)                        │
├─────────────────────────────────────────┤
│ Hero Banner (Carrossel)                 │
├─────────────────────────────────────────┤
│ Categorias em Cards                     │
├─────────────────────────────────────────┤
│ Produtos em Destaque (Grid 4 colunas)  │
├─────────────────────────────────────────┤
│ Banner de Revendedor                    │
├─────────────────────────────────────────┤
│ Produtos Mais Vendidos                  │
└─────────────────────────────────────────┘
```

#### Listagem de Produtos
```
┌────────┬──────────────────────────────┐
│ Filtros│ Breadcrumb                   │
│ Latera│├──────────────────────────────┤
│        │ Resultados (X produtos)      │
│ • Cat. │├──────────────────────────────┤
│ • Prc. │ [Card] [Card] [Card] [Card]  │
│ • Marc.│ [Card] [Card] [Card] [Card]  │
│        │ [Card] [Card] [Card] [Card]  │
│        │                              │
│        │ Paginação                    │
└────────┴──────────────────────────────┘
```

#### Dashboard Revendedor
```
┌─────────────────────────────────────────┐
│ Header com Badge de Nível               │
├────────┬────────────────────────────────┤
│ Menu   │ Cards de Métricas             │
│ Latera │ [Vendas] [Comissão] [Visitas] │
│        ├────────────────────────────────┤
│ • Home │ Gráfico de Vendas             │
│ • Vend.│                                │
│ • Comis│                                │
│ • Saqu.│                                │
│ • Mater│                                │
└────────┴────────────────────────────────┘
```

### 2.6 Ícones e Imagens

**Biblioteca de Ícones:** Material Icons (Google)
- Consistência com design material
- Ícones outline para ações secundárias
- Ícones filled para ações primárias

**Imagens de Produtos:**
- Fundo branco obrigatório
- Formato quadrado (1:1)
- Resolução mínima: 800x800px
- Zoom ao passar o mouse (desktop)
- Gallery com thumbnails

**Placeholders:**
- Skeleton loading (estilo ML)
- Shimmer effect durante carregamento

### 2.7 Animações e Interações

```css
/* Transições suaves */
transition: all 0.2s ease-in-out;

/* Hover em cards */
transform: translateY(-4px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

/* Botões */
- Hover: background mais escuro
- Active: scale(0.98)
- Ripple effect (MUI)
```

### 2.8 Responsividade

**Breakpoints:**
```css
--mobile: 0-599px        (1 coluna)
--tablet: 600-959px      (2 colunas)
--desktop: 960-1279px    (3 colunas)
--large: 1280px+         (4 colunas)
```

**Grid de Produtos:**
- Mobile: 2 colunas
- Tablet: 3 colunas
- Desktop: 4 colunas
- Large: 4-5 colunas

### 2.9 Acessibilidade

- Contraste mínimo WCAG AA (4.5:1 para texto)
- Textos alternativos em imagens
- Navegação por teclado
- ARIA labels em ícones
- Focus visível em elementos interativos

### 2.10 Componentes Customizados MUI

**Sobrescrever tema MUI:**
```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#FFE600',
      dark: '#F2C94C',
    },
    secondary: {
      main: '#3483FA',
    },
    success: {
      main: '#00A650',
    },
    error: {
      main: '#F23D4F',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: { fontSize: 28, fontWeight: 700 },
    h2: { fontSize: 24, fontWeight: 700 },
    body1: { fontSize: 14 },
  },
  shape: {
    borderRadius: 4, // Bordas sutis como ML
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Sem uppercase
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

---

## 3. STACK TECNOLÓGICA

### 2.1 Backend

```yaml
Framework: NestJS 10+
HTTP Adapter: Fastify
ORM: MikroORM 6+ (@mikro-orm/postgresql)
Database: PostgreSQL (via Supabase)
Supabase: BaaS (Auth, Storage, Realtime)
Node: 20+
TypeScript: 5.3+ (strict mode)
Validation: class-validator, class-transformer
Events: @nestjs/event-emitter
Config: @nestjs/config with validation
Testing: Jest + ts-jest
```

### 3.2 Frontend

```yaml
Framework: Next.js 14 (App Router)
UI Library: Material-UI (MUI) v5
Styling: styled-components + MUI styled
Design System: Custom theme (Mercado Livre/Amazon inspired)
Icons: @mui/icons-material + Material Icons
Forms: react-hook-form + yup
HTTP Client: axios
State Management: React Context API
Notifications: notistack (MUI Snackbar)
Image Optimization: Next.js Image component
Animations: Framer Motion (opcional)
Carousel: Swiper.js ou Embla Carousel
```

**Bibliotecas Adicionais para UI:**
```yaml
- react-number-format: Formatação de preços e valores
- react-loading-skeleton: Skeleton screens
- react-tooltip: Tooltips informativos
- react-image-gallery: Gallery de imagens de produtos
- react-share: Botões de compartilhamento social
```

### 2.3 Integrações

```yaml
Payment Gateway (Assinatura): Cielo API
Payment Gateway (Produtos): Cielo API
ERP/Gestão: Bling API v3
Product Images: Magis5 API
Shipping: Melhor Envio API
```

### 3.3 Infraestrutura

```yaml
Monorepo: npm workspaces
Code Quality: ESLint + Prettier
Version Control: Git
CI/CD: (a definir)
Deployment: (a definir)
```

---

## 3.4 COMPONENTES VISUAIS DO FRONTEND

### 3.4.1 Componentes Globais

#### Header Component
```tsx
// src/components/Header/index.tsx
/**
 * Header principal estilo Mercado Livre/Amazon
 * 
 * Características:
 * - Background amarelo (#FFE600)
 * - Logo à esquerda
 * - Barra de busca centralizada (desktop)
 * - Ícones: Carrinho (com badge), Favoritos, Menu usuário
 * - Sticky no scroll
 * - Menu hambúrguer (mobile)
 */

Elementos:
- Logo (clicável → Home)
- SearchBar com autocomplete
- CartIcon com badge de quantidade
- FavoritesIcon
- UserMenu (dropdown)
- MobileMenuIcon
```

#### SearchBar Component
```tsx
// src/components/SearchBar/index.tsx
/**
 * Barra de busca estilo Mercado Livre
 * 
 * Características:
 * - Input com ícone de lupa
 * - Botão amarelo de buscar
 * - Autocomplete com sugestões
 * - Histórico de buscas
 * - Categorias rápidas
 */

Estados:
- Focused: Mostra dropdown com sugestões
- Typing: Busca em tempo real (debounced)
- Selected: Redireciona para resultados
```

#### Footer Component
```tsx
// src/components/Footer/index.tsx
/**
 * Footer informativo
 * 
 * Seções:
 * - Links institucionais (Sobre, Contato, Termos)
 * - Atendimento (FAQ, Trocas e Devoluções)
 * - Redes sociais
 * - Meios de pagamento aceitos
 * - Selos de segurança
 */
```

### 3.4.2 Componentes de Produto

#### ProductCard Component
```tsx
// src/components/ProductCard/index.tsx
/**
 * Card de produto estilo ML/Amazon
 * 
 * Layout:
 * ┌─────────────────┐
 * │ [Badge Oferta]  │
 * │                 │
 * │   [Imagem]      │
 * │                 │
 * ├─────────────────┤
 * │ Título produto  │
 * │ R$ 99,90        │
 * │ 12x R$ 8,33     │
 * │ [Frete Grátis]  │
 * └─────────────────┘
 * 
 * Variações:
 * - Compact (listagem)
 * - Extended (detalhes)
 * - Highlight (destaque homepage)
 */

Props:
- product: Product
- variant: 'compact' | 'extended' | 'highlight'
- onAddToCart: () => void
- onAddToFavorites: () => void
- showBadge?: boolean
- highlightOffer?: boolean
```

#### ProductGallery Component
```tsx
// src/components/ProductGallery/index.tsx
/**
 * Galeria de imagens do produto
 * 
 * Características:
 * - Imagem principal grande
 * - Thumbnails abaixo/lateral
 * - Zoom ao passar mouse (desktop)
 * - Fullscreen lightbox
 * - Swipe em mobile
 */
```

#### PriceDisplay Component
```tsx
// src/components/PriceDisplay/index.tsx
/**
 * Exibição de preço com formatação
 * 
 * Variações:
 * - Com desconto (mostra preço antigo tachado)
 * - Parcelamento destacado
 * - Badge "X% OFF"
 * 
 * Exemplo:
 * R$ 199,90  →  tachado, cor cinza
 * R$ 149,90  →  grande, bold, verde
 * em até 12x de R$ 12,49 sem juros
 * [Badge: 25% OFF]
 */
```

### 3.4.3 Componentes de Listagem

#### ProductGrid Component
```tsx
// src/components/ProductGrid/index.tsx
/**
 * Grid responsivo de produtos
 * 
 * Breakpoints:
 * - Mobile: 2 colunas
 * - Tablet: 3 colunas
 * - Desktop: 4 colunas
 * 
 * Características:
 * - Lazy loading
 * - Skeleton loading
 * - Paginação infinita (scroll) ou numbered
 */
```

#### FilterSidebar Component
```tsx
// src/components/FilterSidebar/index.tsx
/**
 * Sidebar de filtros estilo Mercado Livre
 * 
 * Filtros:
 * - Categorias (hierárquicas, expansíveis)
 * - Faixa de preço (slider)
 * - Marcas (checkboxes)
 * - Condição (Novo/Usado)
 * - Frete grátis (toggle)
 * - Ordenação (select)
 * 
 * Mobile: Modal drawer
 * Desktop: Sidebar fixa
 */
```

#### Breadcrumb Component
```tsx
// src/components/Breadcrumb/index.tsx
/**
 * Navegação por breadcrumb
 * 
 * Exemplo:
 * Home > Decoração > Sala > Sofás
 * 
 * Características:
 * - Links clicáveis
 * - Separador ">"
 * - Último item não clicável
 */
```

### 3.4.4 Componentes de Checkout

#### CartDrawer Component
```tsx
// src/components/CartDrawer/index.tsx
/**
 * Drawer lateral do carrinho (estilo ML)
 * 
 * Características:
 * - Slide-in da direita
 * - Lista de itens com imagem, nome, preço
 * - Quantidade editável
 * - Remover item
 * - Subtotal
 * - Botão "Finalizar Compra" fixo no bottom
 */
```

#### CheckoutStepper Component
```tsx
// src/components/CheckoutStepper/index.tsx
/**
 * Stepper horizontal do checkout
 * 
 * Etapas:
 * 1. Carrinho
 * 2. Endereço de Entrega
 * 3. Forma de Pagamento
 * 4. Revisão do Pedido
 * 
 * Estados:
 * - Completed: check verde
 * - Active: círculo amarelo
 * - Pending: círculo cinza
 */
```

#### ShippingCalculator Component
```tsx
// src/components/ShippingCalculator/index.tsx
/**
 * Calculadora de frete
 * 
 * Input:
 * - CEP (máscara 00000-000)
 * - Botão "Calcular"
 * 
 * Output:
 * - Lista de opções (PAC, SEDEX, etc)
 * - Prazo de entrega
 * - Preço de cada opção
 * - Seleção via radio button
 */
```

### 3.4.5 Componentes do Dashboard Revendedor

#### MetricsCard Component
```tsx
// src/components/reseller/MetricsCard/index.tsx
/**
 * Card de métrica do dashboard
 * 
 * Props:
 * - title: string (ex: "Vendas Este Mês")
 * - value: string | number (ex: "R$ 1.234,56")
 * - icon: ReactNode
 * - trend?: 'up' | 'down' | 'neutral'
 * - trendValue?: string (ex: "+15%")
 * - color?: 'primary' | 'success' | 'warning'
 * 
 * Layout:
 * ┌──────────────────┐
 * │ [Icon]  Vendas   │
 * │ R$ 1.234,56      │
 * │ ↑ +15% vs mês ant│
 * └──────────────────┘
 */
```

#### SalesChart Component
```tsx
// src/components/reseller/SalesChart/index.tsx
/**
 * Gráfico de vendas/comissões
 * 
 * Tipos:
 * - Line chart (vendas ao longo do tempo)
 * - Bar chart (vendas por categoria)
 * - Donut chart (distribuição de produtos)
 * 
 * Biblioteca: Recharts ou Chart.js
 */
```

#### ResellerLevelBadge Component
```tsx
// src/components/reseller/ResellerLevelBadge/index.tsx
/**
 * Badge do nível do revendedor
 * 
 * Variações:
 * - Bronze: cor bronze, ícone bronze
 * - Prata: cor prata, ícone prata
 * - Ouro: cor ouro, ícone ouro
 * 
 * Exibe:
 * - Nível atual
 * - Progresso para próximo nível (barra)
 * - Falta X para subir de nível
 */
```

#### AffiliateLink Component
```tsx
// src/components/reseller/AffiliateLink/index.tsx
/**
 * Exibição do link de afiliado
 * 
 * Características:
 * - Input read-only com link
 * - Botão "Copiar" com feedback
 * - QR Code para compartilhar
 * - Botões de share social (WhatsApp, Facebook, Instagram)
 * 
 * Layout:
 * ┌─────────────────────────────┐
 * │ Seu link de afiliado:       │
 * │ [kazatem.shop/r/PAULO_ABC]  │
 * │ [Copiar] [QR Code] [Share]  │
 * └─────────────────────────────┘
 */
```

#### MaterialDownload Component
```tsx
// src/components/reseller/MaterialDownload/index.tsx
/**
 * Card de material de marketing
 * 
 * Características:
 * - Thumbnail do material
 * - Nome do arquivo
 * - Tipo (Banner, Post, Catálogo)
 * - Botão de download
 * - Preview ao clicar
 * 
 * Layout em grid:
 * [Card] [Card] [Card]
 * [Card] [Card] [Card]
 */
```

### 3.4.6 Componentes de Notificação e Feedback

#### SnackbarNotification Component
```tsx
// Usa notistack (já configurado)
/**
 * Notificações toast
 * 
 * Variações:
 * - success: fundo verde, ícone check
 * - error: fundo vermelho, ícone X
 * - warning: fundo amarelo, ícone !
 * - info: fundo azul, ícone i
 * 
 * Posição: top-right (desktop), top-center (mobile)
 * Duração: 3s (sucesso), 5s (erro)
 * Auto-hide: sim
 */
```

#### LoadingSkeleton Component
```tsx
// src/components/LoadingSkeleton/index.tsx
/**
 * Skeleton loading para diferentes componentes
 * 
 * Variações:
 * - ProductCardSkeleton
 * - ProductDetailSkeleton
 * - DashboardSkeleton
 * 
 * Usa: react-loading-skeleton
 * Efeito: shimmer (estilo ML)
 */
```

#### EmptyState Component
```tsx
// src/components/EmptyState/index.tsx
/**
 * Estado vazio genérico
 * 
 * Props:
 * - icon: ReactNode
 * - title: string
 * - description: string
 * - action?: { label: string, onClick: () => void }
 * 
 * Exemplos:
 * - Carrinho vazio
 * - Sem produtos encontrados
 * - Sem comissões ainda
 */
```

### 3.4.7 Estrutura de Pastas do Frontend

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (shop)/
│   │   │   ├── page.tsx              # Homepage
│   │   │   ├── products/
│   │   │   │   ├── page.tsx          # Listagem
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Detalhes
│   │   │   ├── cart/
│   │   │   └── checkout/
│   │   ├── (reseller)/
│   │   │   ├── dashboard/
│   │   │   ├── sales/
│   │   │   ├── commissions/
│   │   │   ├── withdrawals/
│   │   │   └── materials/
│   │   ├── r/
│   │   │   └── [link]/               # Landing page do revendedor
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── Header/
│   │   ├── Footer/
│   │   ├── SearchBar/
│   │   ├── ProductCard/
│   │   ├── ProductGallery/
│   │   ├── PriceDisplay/
│   │   ├── ProductGrid/
│   │   ├── FilterSidebar/
│   │   ├── Breadcrumb/
│   │   ├── CartDrawer/
│   │   ├── CheckoutStepper/
│   │   ├── ShippingCalculator/
│   │   ├── LoadingSkeleton/
│   │   ├── EmptyState/
│   │   └── reseller/
│   │       ├── MetricsCard/
│   │       ├── SalesChart/
│   │       ├── ResellerLevelBadge/
│   │       ├── AffiliateLink/
│   │       └── MaterialDownload/
│   │
│   ├── services/
│   │   ├── api.ts                    # Axios config
│   │   ├── productService.ts
│   │   ├── resellerService.ts
│   │   ├── orderService.ts
│   │   └── authService.ts
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── SnackbarContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCart.ts
│   │   ├── useSnackbar.ts
│   │   └── useDebounce.ts
│   │
│   ├── types/
│   │   ├── product.ts
│   │   ├── order.ts
│   │   ├── reseller.ts
│   │   └── user.ts
│   │
│   ├── styles/
│   │   ├── theme.ts                  # MUI theme customizado
│   │   ├── globalStyles.ts
│   │   └── colors.ts                 # Paleta de cores
│   │
│   └── utils/
│       ├── formatters.ts             # Preço, data, CPF
│       ├── validators.ts
│       └── constants.ts
│
├── public/
│   ├── images/
│   │   ├── logo.svg
│   │   ├── placeholder.png
│   │   └── badges/
│   ├── icons/
│   └── fonts/
│
├── package.json
├── next.config.js
├── tsconfig.json
└── .env.local
```

---

## 3.5 GUIA DE ESTILO DE CÓDIGO (FRONTEND)

### Exemplo de Implementação: ProductCard

```tsx
// src/components/ProductCard/index.tsx
import { Card, CardContent, CardMedia, Typography, Chip, IconButton } from '@mui/material';
import { FavoriteOutlined, ShoppingCartOutlined } from '@mui/icons-material';
import { Container, PriceContainer, OldPrice, CurrentPrice, InstallmentText } from './styles';
import { formatCurrency } from '@/utils/formatters';
import { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  variant?: 'compact' | 'extended';
  onAddToCart?: () => void;
  onAddToFavorites?: () => void;
}

export function ProductCard({
  product,
  variant = 'compact',
  onAddToCart,
  onAddToFavorites,
}: ProductCardProps) {
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPercentage = hasDiscount
    ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)
    : 0;

  return (
    <Container>
      {hasDiscount && (
        <Chip
          label={`${discountPercentage}% OFF`}
          color="error"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
        />
      )}

      <Card elevation={0} sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height={variant === 'extended' ? '300' : '200'}
          image={product.image || '/images/placeholder.png'}
          alt={product.name}
          sx={{ objectFit: 'contain', backgroundColor: '#fff' }}
        />

        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8 }}
          onClick={onAddToFavorites}
        >
          <FavoriteOutlined />
        </IconButton>

        <CardContent>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '40px',
            }}
          >
            {product.name}
          </Typography>

          <PriceContainer>
            {hasDiscount && (
              <OldPrice>{formatCurrency(product.oldPrice!)}</OldPrice>
            )}
            <CurrentPrice>{formatCurrency(product.price)}</CurrentPrice>
            <InstallmentText>
              em até 12x de {formatCurrency(product.price / 12)} sem juros
            </InstallmentText>
          </PriceContainer>

          {product.freeShipping && (
            <Chip
              label="Frete grátis"
              color="success"
              size="small"
              sx={{ mt: 1 }}
            />
          )}

          <IconButton
            color="primary"
            onClick={onAddToCart}
            sx={{ mt: 1, width: '100%' }}
          >
            <ShoppingCartOutlined />
            <Typography variant="button" sx={{ ml: 1 }}>
              Adicionar
            </Typography>
          </IconButton>
        </CardContent>
      </Card>
    </Container>
  );
}
```

```typescript
// src/components/ProductCard/styles.ts
import styled from 'styled-components';
import { styled as muiStyled } from '@mui/material/styles';

export const Container = styled.div`
  position: relative;
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

export const PriceContainer = styled.div`
  margin-top: 8px;
`;

export const OldPrice = muiStyled('span')(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.text.secondary,
  textDecoration: 'line-through',
  marginRight: '8px',
}));

export const CurrentPrice = muiStyled('span')(({ theme }) => ({
  fontSize: '24px',
  fontWeight: 700,
  color: theme.palette.text.primary,
  display: 'block',
}));

export const InstallmentText = muiStyled('span')(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.success.main,
  display: 'block',
  marginTop: '4px',
}));
```

---

## 3.6 MOCKUPS VISUAIS (ASCII)

### Homepage - Desktop

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  [LOGO]    [═══════ BUSCAR PRODUTOS ══════════] [🛒3] [♥] [👤]              ║
║            Categorias ▼                         Bronze | Painel              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌────────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                        │ ║
║  │              🏠  TRANSFORME SUA CASA EM UM LAR DOS SONHOS             │ ║
║  │                  Produtos premium para decoração                      │ ║
║  │                        [VER PRODUTOS]                                 │ ║
║  │                          ● ● ○                                        │ ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
║                                                                              ║
║  Categorias                                                                  ║
║  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             ║
║  │  🛏️    │ │  🍽️    │ │  🚿     │ │  💡     │ │  📦     │             ║
║  │  Cama   │ │  Mesa   │ │  Banho  │ │  Decor  │ │  Utilid │             ║
║  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘             ║
║                                                                              ║
║  Produtos em Destaque                                        Ver todos >    ║
║  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                              ║
║  │[25%OFF]│ │        │ │        │ │[NOVO]  │                              ║
║  │  📷    │ │  📷    │ │  📷    │ │  📷    │                              ║
║  │        │ │        │ │        │ │        │                              ║
║  │Travessei│ │Mesa Cen│ │Tapete  │ │Luminária│                             ║
║  │~~R$79~~│ │R$ 299  │ │R$ 189  │ │R$ 159  │                              ║
║  │R$ 59,90│ │12x 24,92│ │12x15,75│ │12x13,25│                              ║
║  │[♥] [🛒]│ │[♥] [🛒]│ │[♥] [🛒]│ │[♥] [🛒]│                              ║
║  └────────┘ └────────┘ └────────┘ └────────┘                              ║
║                                                                              ║
║  ┌────────────────────────────────────────────────────────────────────────┐ ║
║  │  👑  SEJA UM REVENDEDOR                                                │ ║
║  │  Ganhe 30% de comissão vendendo produtos exclusivos                   │ ║
║  │                   [TORNAR-SE REVENDEDOR]                              │ ║
║  └────────────────────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Sobre | Contato | FAQ | Termos             [f] [instagram] [twitter]      ║
║  © 2025 Kaza Tem Imports - Todos os direitos reservados                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Listagem de Produtos - Desktop

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  [LOGO]    [═══════ BUSCAR ═══════] [🛒] [♥] [👤]                          ║
╠════════╦═════════════════════════════════════════════════════════════════════╣
║ FILTROS║ Home > Decoração > Sala                                            ║
║        ║                                                                     ║
║ Categ. ║ Mostrando 24 de 156 resultados      [Mais vendidos ▼]             ║
║ ▼ Sala ║                                                                     ║
║   · Sofá║ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                      ║
║   · Mesa║ │[15%OFF]│ │        │ │        │ │        │                      ║
║   · Deco║ │  📷    │ │  📷    │ │  📷    │ │  📷    │                      ║
║        ║ │        │ │        │ │        │ │        │                      ║
║ Preço  ║ │Poltrona│ │Mesa Lat│ │Luminária│ │Quadro  │                      ║
║ R$  [══]║ │~~R$899~│ │R$ 349  │ │R$ 189  │ │R$ 129  │                      ║
║   R$ 2k║ │R$ 749  │ │12x29,08│ │FRETE ✓ │ │12x10,75│                      ║
║        ║ │[♥] [🛒]│ │[♥] [🛒]│ │[♥] [🛒]│ │[♥] [🛒]│                      ║
║ [x]Novo║ └────────┘ └────────┘ └────────┘ └────────┘                      ║
║ [ ]Usado║                                                                    ║
║        ║ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                      ║
║ Frete  ║ │        │ │        │ │[PROMO] │ │        │                      ║
║ [x]Gráti║ │  📷    │ │  📷    │ │  📷    │ │  📷    │                      ║
║        ║ │        │ │        │ │        │ │        │                      ║
║ [Limpar║ │...      │ │...      │ │...      │ │...      │                      ║
║ Filtros║ │...      │ │...      │ │...      │ │...      │                      ║
║        ║ └────────┘ └────────┘ └────────┘ └────────┘                      ║
║        ║                                                                     ║
║        ║              [1] [2] [3] ... [10] [Próximo >]                      ║
╚════════╩═════════════════════════════════════════════════════════════════════╝
```

### Detalhes do Produto - Desktop

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  [LOGO]    [═══════ BUSCAR ═══════] [🛒] [♥] [👤]                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Home > Decoração > Sala > Sofás                                             ║
║                                                                              ║
║ ┌────────────────────────────┬─────────────────────────────────────────────┐║
║ │                            │  Sofá 3 Lugares Retrátil Cinza              │║
║ │        [FOTO GRANDE]       │                                              │║
║ │                            │  ⭐⭐⭐⭐⭐ (127 avaliações)               │║
║ │                            │                                              │║
║ │  [◻️] [◻️] [◻️] [◻️]      │  ~~R$ 2.499,00~~  [25% OFF]                │║
║ │                            │  R$ 1.899,00                                 │║
║ │  [🔍 Ver em tela cheia]   │  ou 12x de R$ 158,25 sem juros              │║
║ │                            │                                              │║
║ │                            │  ✅ Em estoque - Pronta entrega             │║
║ │                            │  🚚 Frete Grátis para sua região            │║
║ │                            │                                              │║
║ │                            │  Quantidade: [- 1 +]                         │║
║ │                            │                                              │║
║ │                            │  [  💛  COMPRAR AGORA  ]                    │║
║ │                            │  [     🛒 ADICIONAR AO CARRINHO     ]        │║
║ │                            │  [  ♡  Adicionar aos Favoritos  ]           │║
║ └────────────────────────────┴─────────────────────────────────────────────┘║
║                                                                              ║
║ ┌──────────────────────────────────────────────────────────────────────────┐║
║ │ [Descrição] [Especificações] [Avaliações] [Perguntas]                   │║
║ ├──────────────────────────────────────────────────────────────────────────┤║
║ │                                                                          │║
║ │ Sofá retrátil de alta qualidade, perfeito para sua sala de estar...     │║
║ │                                                                          │║
║ │ Características:                                                         │║
║ │ • Material: Tecido suede                                                 │║
║ │ • Dimensões: 2,20m x 0,90m x 0,85m                                      │║
║ │ • Capacidade: 3 pessoas                                                  │║
║ │                                                                          │║
║ └──────────────────────────────────────────────────────────────────────────┘║
║                                                                              ║
║ Produtos Relacionados                                                        ║
║ [Card] [Card] [Card] [Card]                                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Dashboard Revendedor - Desktop

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  [LOGO]              [🔔3]  Paulo Ricardo #360  [🥉Bronze]  [👤]            ║
╠════════╦═════════════════════════════════════════════════════════════════════╣
║ 📊 Home║ Olá, Paulo! 👋                                                      ║
║        ║ Você está no nível Bronze                                           ║
║ 💰 Vend║ [████████████░░░░░░░░] 65% para Prata (Faltam R$ 525,00)          ║
║        ║                                                                     ║
║ 💵 Comi║ Seu link de revenda:                                                ║
║        ║ ┌────────────────────────────────────────────────────────────────┐ ║
║ 💸 Saqu║ │ kazatem.shop/r/PAULORICARDOBATISTADAS_MIRNRQWD  [COPIAR] [QR] │ ║
║        ║ └────────────────────────────────────────────────────────────────┘ ║
║ 🎨 Mate║                                                                     ║
║        ║ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              ║
║ 🎫 Cupo║ │ 💰       │ │ 💵       │ │ 👁️      │ │ 📈       │              ║
║        ║ │ Total    │ │ Comissão │ │ Visitas  │ │ Conversão│              ║
║ ⚙️ Conf║ │ Vendido  │ │ Total    │ │ ao Link  │ │          │              ║
║        ║ │          │ │          │ │          │ │          │              ║
║ 🚪 Sair║ │R$ 0,00   │ │R$ 0,00   │ │ 0        │ │ 0%       │              ║
║        ║ │↑ +0% mês │ │✓Disponíve│ │↓ -0% sem.│ │→ 0% mês  │              ║
║        ║ └──────────┘ └──────────┘ └──────────┘ └──────────┘              ║
║        ║                                                                     ║
║        ║ Vendas nos Últimos 30 Dias                                         ║
║        ║ ┌────────────────────────────────────────────────────────────────┐ ║
║        ║ │  R$                                                             │ ║
║        ║ │ 2000│                                       ╱╲                  │ ║
║        ║ │ 1500│                             ╱╲      ╱  ╲                 │ ║
║        ║ │ 1000│                   ╱╲      ╱  ╲    ╱    ╲                │ ║
║        ║ │  500│         ╱╲      ╱  ╲    ╱    ╲  ╱      ╲               │ ║
║        ║ │    0└────────────────────────────────────────────────────────> │ ║
║        ║ │     Jan  Fev  Mar  Abr  Mai  Jun  Jul  Ago  Set  Out  Nov  Dez│ ║
║        ║ └────────────────────────────────────────────────────────────────┘ ║
║        ║                                                                     ║
║        ║ Últimas Vendas                                    Ver todas >      ║
║        ║ ┌────────────────────────────────────────────────────────────────┐ ║
║        ║ │ Data       │ Produto        │ Valor    │ Comissão │ Status    │ ║
║        ║ ├────────────────────────────────────────────────────────────────┤ ║
║        ║ │ Nenhuma comissão ainda.                                        │ ║
║        ║ │ Compartilhe seu link para começar a vender!                    │ ║
║        ║ └────────────────────────────────────────────────────────────────┘ ║
╚════════╩═════════════════════════════════════════════════════════════════════╝
```

### Carrinho (Drawer Lateral) - Desktop

```
                                    ┌──────────────────────────────────────┐
                                    │ Seu Carrinho (3 itens)        [✕]   │
                                    ├──────────────────────────────────────┤
                                    │                                      │
                                    │ ┌──┬──────────────────────────────┐ │
                                    │ │📷│ Travesseiro Ortopédico      │ │
                                    │ │  │ R$ 59,90                     │ │
                                    │ │  │ Qtd: [- 2 +]          [🗑️]  │ │
                                    │ └──┴──────────────────────────────┘ │
                                    │                                      │
                                    │ ┌──┬──────────────────────────────┐ │
                                    │ │📷│ Mesa de Centro Vidro         │ │
                                    │ │  │ R$ 299,00                    │ │
                                    │ │  │ Qtd: [- 1 +]          [🗑️]  │ │
                                    │ └──┴──────────────────────────────┘ │
                                    │                                      │
                                    │ ┌──┬──────────────────────────────┐ │
                                    │ │📷│ Tapete Sala Cinza            │ │
                                    │ │  │ R$ 189,00                    │ │
                                    │ │  │ Qtd: [- 1 +]          [🗑️]  │ │
                                    │ └──┴──────────────────────────────┘ │
                                    │                                      │
                                    ├──────────────────────────────────────┤
                                    │ Subtotal:          R$ 607,80         │
                                    │ Frete:             A calcular        │
                                    │                                      │
                                    │ [  💛  FINALIZAR COMPRA  ]          │
                                    │ [  Continuar Comprando  ]            │
                                    │                                      │
                                    └──────────────────────────────────────┘
```

---

## 4. ARQUITETURA DO SISTEMA

### 3.1 Estrutura Geral do Monorepo

```
GitSpread/
├── packages/
│   ├── domain-primitives/      # Classes base DDD (já existe)
│   └── shared-kernel/           # Types, utils compartilhados (já existe)
│
└── apps/
    └── kaza-tem-system/         # NOVO SISTEMA
        ├── backend/
        │   ├── src/
        │   │   ├── contexts/           # Bounded Contexts
        │   │   │   ├── product/
        │   │   │   ├── reseller/
        │   │   │   ├── order/
        │   │   │   ├── commission/
        │   │   │   ├── subscription/
        │   │   │   ├── withdrawal/
        │   │   │   └── marketing/
        │   │   │
        │   │   ├── infrastructure/
        │   │   │   ├── http/
        │   │   │   ├── persistence/
        │   │   │   └── integrations/
        │   │   │       ├── bling/
        │   │   │       ├── magis5/
        │   │   │       ├── cielo/
        │   │   │       └── melhor-envio/
        │   │   │
        │   │   ├── config/
        │   │   ├── app.module.ts
        │   │   └── main.ts
        │   │
        │   ├── test/
        │   ├── package.json
        │   └── tsconfig.json
        │
        └── frontend/
            ├── src/
            │   ├── app/              # Next.js App Router
            │   ├── components/
            │   ├── services/
            │   ├── contexts/
            │   ├── hooks/
            │   ├── types/
            │   └── styles/
            │
            ├── public/
            ├── package.json
            └── next.config.js
```

### 3.2 Arquitetura Hexagonal (Backend)

Cada Bounded Context segue a estrutura de 3 camadas:

```
contexts/<context-name>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── exceptions/
│   └── services/          # Domain Services (opcional)
│
├── application/
│   ├── use-cases/
│   ├── ports/
│   │   ├── input/        # Command/Query handlers (opcional)
│   │   └── output/       # Repository interfaces, Gateway interfaces
│   └── dto/
│
└── <context>.module.ts
```

**Infraestrutura** (adapters) separada em `src/infrastructure/`:
- `http/`: Controllers, Request/Response DTOs
- `persistence/`: ORM entities, repositories, mappers
- `integrations/`: Clients para APIs externas

---

## 4. BOUNDED CONTEXTS (DDD)

### 4.1 Product Context

**Responsabilidade:** Gerenciar catálogo de produtos sincronizados do Bling/Magis5

**Entidades:**
- `Product` (Aggregate Root)
- `ProductCategory`
- `ProductImage`
- `ProductVariant` (opcional, para variações como tamanho/cor)

**Value Objects:**
- `ProductId`
- `SKU`
- `Price`
- `Stock`

**Use Cases:**
- `SyncProductsFromBling`
- `SyncProductImagesFromMagis5`
- `GetProductById`
- `SearchProducts`
- `GetProductsByCategory`
- `UpdateProductStock` (via webhook Bling)

### 4.2 Reseller Context

**Responsabilidade:** Gerenciar cadastro, níveis e configurações de revendedores

**Entidades:**
- `Reseller` (Aggregate Root)
- `ResellerLevel` (Bronze/Silver/Gold)
- `ResellerSettings`

**Value Objects:**
- `ResellerId`
- `UniqueLink`
- `CPF`
- `Email`

**Events:**
- `ResellerRegistered`
- `ResellerApproved`
- `ResellerRejected`
- `ResellerLevelChanged`
- `ResellerDeactivated`

**Use Cases:**
- `RegisterReseller`
- `ApproveResellerRegistration`
- `RejectResellerRegistration`
- `GenerateUniqueLink`
- `GetResellerByLink`
- `UpdateResellerLevel`
- `GetResellerDashboard`
- `AllowCustomPricing` (admin habilita para revendedor específico)

### 4.3 Subscription Context

**Responsabilidade:** Gerenciar assinaturas mensais dos revendedores (Cielo)

**Entidades:**
- `Subscription` (Aggregate Root)
- `Payment`

**Value Objects:**
- `SubscriptionId`
- `SubscriptionStatus` (active, suspended, canceled)
- `Amount`

**Events:**
- `SubscriptionCreated`
- `PaymentProcessed`
- `PaymentFailed`
- `SubscriptionCanceled`

**Use Cases:**
- `CreateSubscription`
- `ProcessRecurringPayment` (cron job mensal)
- `HandlePaymentWebhook` (Cielo)
- `CancelSubscription`
- `ReactivateSubscription`

### 4.4 Order Context

**Responsabilidade:** Gerenciar pedidos do e-commerce

**Entidades:**
- `Order` (Aggregate Root)
- `OrderItem`
- `ShippingAddress`

**Value Objects:**
- `OrderId`
- `OrderStatus` (pending, paid, shipped, delivered, canceled)
- `TrackingCode`

**Events:**
- `OrderCreated`
- `OrderPaid`
- `OrderCanceled`
- `OrderShipped`

**Use Cases:**
- `CreateOrder`
- `ProcessPayment` (Cielo checkout)
- `CalculateShipping` (Melhor Envio)
- `CreateOrderInBling` (após pagamento confirmado)
- `HandlePaymentWebhook`
- `TrackOrderStatus`

### 4.5 Commission Context

**Responsabilidade:** Calcular e gerenciar comissões dos revendedores

**Entidades:**
- `Commission` (Aggregate Root)
- `CommissionRule` (regras graduais configuráveis)

**Value Objects:**
- `CommissionId`
- `CommissionStatus` (pending, available, withdrawn)
- `Percentage`

**Events:**
- `CommissionCalculated`
- `CommissionAvailable`
- `CommissionWithdrawn`

**Use Cases:**
- `CalculateCommissionForOrder`
- `GetResellerCommissionBalance`
- `GetCommissionHistory`
- `ConfigureCommissionRules` (admin)

### 4.6 Withdrawal Context

**Responsabilidade:** Gerenciar saques de comissões

**Entities:**
- `Withdrawal` (Aggregate Root)

**Value Objects:**
- `WithdrawalId`
- `WithdrawalStatus` (requested, approved, rejected, paid)
- `BankAccount`

**Events:**
- `WithdrawalRequested`
- `WithdrawalApproved`
- `WithdrawalRejected`
- `WithdrawalPaid`

**Use Cases:**
- `RequestWithdrawal`
- `ApproveWithdrawal`
- `RejectWithdrawal`
- `CreatePayableInBling` (contas a pagar no Bling)
- `GetWithdrawalHistory`

### 4.7 Marketing Context

**Responsabilidade:** Gerenciar materiais de marketing e cupons

**Entities:**
- `MarketingMaterial`
- `Coupon`

**Value Objects:**
- `CouponCode`
- `DiscountPercentage`

**Use Cases:**
- `UploadMarketingMaterial`
- `GetMarketingMaterials`
- `CreateCoupon`
- `ValidateCoupon`
- `TrackCouponUsage`

### 4.8 Analytics Context

**Responsabilidade:** Rastrear leads, visitas e conversões

**Entities:**
- `Lead`
- `Visit`
- `Conversion`

**Use Cases:**
- `TrackVisit`
- `TrackLead`
- `RecordConversion`
- `GetResellerAnalytics`

---

## 5. INTEGRAÇÕES EXTERNAS

### 5.1 Bling API

**Documentação:** https://developer.bling.com.br/

**Autenticação:** OAuth 2.0

**Endpoints a Integrar:**

```typescript
// Produtos
GET /api/v3/produtos - Listar produtos
GET /api/v3/produtos/{id} - Detalhes do produto
PUT /api/v3/produtos/{id}/estoque - Atualizar estoque

// Pedidos
POST /api/v3/pedidos/vendas - Criar pedido
GET /api/v3/pedidos/vendas/{id} - Detalhes do pedido

// Contas a Pagar
POST /api/v3/contas/pagar - Criar conta a pagar (saques)

// Webhooks
POST /webhook/bling - Receber eventos (estoque, pedidos)
```

**Configurações Necessárias:**
- Client ID
- Client Secret
- Redirect URI
- Token de Acesso (renovável)

### 5.2 Magis5 API

**Documentação:** (solicitar ao fornecedor)

**Autenticação:** API Key

**Endpoints:**

```typescript
GET /api/produtos/{sku}/imagens - Buscar imagens por SKU
```

**Sincronização:** Cron job diário ou webhook

### 5.3 Cielo API

**Documentação:** https://developercielo.github.io/

**Produtos a Usar:**
- **Cielo Checkout** para pagamentos de produtos
- **Recorrência Cielo** para assinaturas

**Endpoints:**

```typescript
// Checkout (Produtos)
POST /1/sales - Criar transação
GET /1/sales/{paymentId} - Consultar transação

// Recorrência (Assinatura)
POST /1/RecurrentPayment - Criar recorrência
PUT /1/RecurrentPayment/{id}/Deactivate - Cancelar
```

**Webhooks:**
- Notificação de pagamento (produtos)
- Notificação de cobrança recorrente

### 5.4 Melhor Envio API

**Documentação:** https://docs.melhorenvio.com.br/

**Autenticação:** Bearer Token

**Endpoints:**

```typescript
POST /api/v2/me/shipment/calculate - Calcular frete
POST /api/v2/me/cart - Adicionar à sacola
POST /api/v2/me/shipment/checkout - Finalizar compra de frete
```

**Integração com Bling:** Verificar se Bling já tem integração ativa

---

## 6. SCHEMAS DE BANCO DE DADOS

**IMPORTANTE:** Todos os schemas utilizam **PostgreSQL** (via Supabase).

### Convenções PostgreSQL vs SQL Server

Este projeto migrou de SQL Server para PostgreSQL. As principais diferenças:

| SQL Server | PostgreSQL | Notas |
|------------|------------|-------|
| `UUID` | `UUID` | IDs únicos |
| `gen_random_uuid()` | `gen_random_uuid()` | Geração de UUID |
| `BIT` | `BOOLEAN` | Valores true/false |
| `TIMESTAMP` | `TIMESTAMP` | Data e hora |
| `NOW()` | `NOW()` | Data/hora atual |
| `INDEX inline` | `CREATE INDEX separado` | Índices |

### Supabase Features

**Auth (Opcional):**
- Supabase fornece autenticação pronta (JWT, OAuth, Magic Links)
- Podemos usar `supabase.auth` no frontend
- Tabela `auth.users` gerenciada pelo Supabase
- Nossa tabela `users` pode referenciar `auth.users.id`

**Storage:**
- Upload de imagens de materiais de marketing
- Bucket público para imagens de produtos (opcional, se não usar Magis5)
- Bucket privado para documentos de revendedores

**Realtime (Opcional):**
- Notificações em tempo real (novas vendas, status de pedidos)
- WebSocket subscriptions

**Row Level Security (RLS):**
- Aplicar políticas de segurança no próprio banco
- Exemplo: Revendedor só vê suas próprias comissões

### 6.1 Products (Contexto: Product)

```sql
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

### 6.2 Resellers (Contexto: Reseller)

```sql
-- Tabela: resellers
CREATE TABLE resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  unique_link VARCHAR(255) UNIQUE NOT NULL,
  cpf VARCHAR(14) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, approved, rejected, active, suspended
  level VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold
  can_set_custom_price BOOLEAN DEFAULT false,
  approved_at TIMESTAMP,
  approved_by UUID,
  rejected_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: users (base para resellers e clientes)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL, -- customer, reseller, admin
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: reseller_levels_config (configuração de níveis)
CREATE TABLE reseller_levels_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL,
  min_annual_sales DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.3 Subscriptions (Contexto: Subscription)

```sql
-- Tabela: subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL,
  cielo_recurrence_id VARCHAR(100),
  status VARCHAR(20) NOT NULL, -- active, suspended, canceled
  amount DECIMAL(10,2) NOT NULL,
  next_billing_date DATE,
  started_at TIMESTAMP DEFAULT NOW(),
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: subscription_payments
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  cielo_payment_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, paid, failed, refunded
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);
```

### 6.4 Orders (Contexto: Order)

```sql
-- Tabela: orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  reseller_id UUID, -- NULL se compra direta
  bling_order_id VARCHAR(50) UNIQUE,
  status VARCHAR(20) NOT NULL, -- pending, paid, shipped, delivered, canceled
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  cielo_payment_id VARCHAR(100),
  tracking_code VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  -- INDEX será criado após a tabela
);

-- Tabela: shipping_addresses
CREATE TABLE shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  street VARCHAR(255) NOT NULL,
  number VARCHAR(20) NOT NULL,
  complement VARCHAR(100),
  neighborhood VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  phone VARCHAR(20),
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

### 6.5 Commissions (Contexto: Commission)

```sql
-- Tabela: commissions
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL,
  order_id UUID NOT NULL,
  sale_amount DECIMAL(10,2) NOT NULL, -- total - shipping
  commission_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, available, withdrawn
  available_at DATE, -- data em que fica disponível para saque
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: commission_rules (regras graduais configuráveis)
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_monthly_sales DECIMAL(10,2) NOT NULL,
  max_monthly_sales DECIMAL(10,2),
  percentage DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- INDEX será criado após a tabela
);
```

### 6.6 Withdrawals (Contexto: Withdrawal)

```sql
-- Tabela: withdrawals
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- requested, approved, rejected, paid
  bank_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL, -- checking, savings
  agency VARCHAR(20) NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  account_holder_cpf VARCHAR(14) NOT NULL,
  bling_payable_id VARCHAR(50), -- ID da conta a pagar no Bling
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID,
  rejected_at TIMESTAMP,
  rejected_reason TEXT,
  paid_at TIMESTAMP,
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);
```

### 6.7 Marketing (Contexto: Marketing)

```sql
-- Tabela: marketing_materials
CREATE TABLE marketing_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- image, video, pdf
  category VARCHAR(50), -- banner, post, catalog
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: coupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID, -- NULL = cupom geral
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL, -- percentage, fixed
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_value DECIMAL(10,2),
  max_uses INT,
  current_uses INT DEFAULT 0,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);
```

### 6.8 Analytics (Contexto: Analytics)

```sql
-- Tabela: visits
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID,
  session_id VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer VARCHAR(500),
  landing_page VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);

-- Tabela: leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID,
  session_id VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  name VARCHAR(255),
  product_id UUID,
  source VARCHAR(50), -- cart_abandoned, contact_form, newsletter
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (reseller_id) REFERENCES resellers(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  -- INDEX será criado após a tabela,
  -- INDEX será criado após a tabela
);
```

### 6.9 System Configuration

```sql
-- Tabela: system_config
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- INDEX será criado após a tabela
);

-- Configurações iniciais
INSERT INTO system_config (key, value, description) VALUES
('subscription_price', '9.90', 'Valor mensal da assinatura de revendedor'),
('withdrawal_min_amount', '50.00', 'Valor mínimo para saque'),
('withdrawal_release_days', '30', 'Dias após venda para liberar comissão'),
('melhor_envio_token', 'your_token_here', 'Token de integração Melhor Envio'),
('bling_client_id', 'your_client_id', 'Bling OAuth Client ID'),
('bling_client_secret', 'your_secret', 'Bling OAuth Client Secret'),
('cielo_merchant_id', 'your_merchant_id', 'Cielo Merchant ID'),
('cielo_merchant_key', 'your_key', 'Cielo Merchant Key');
```

---

## 7. FASES DE IMPLEMENTAÇÃO

### FASE 1: E-commerce Básico com Catálogo

**Objetivo:** Sistema funcional de e-commerce com produtos

**Bounded Contexts:**
- Product Context (completo)
- Order Context (básico - sem pagamento ainda)
- User Context (autenticação básica)

**Implementar:**

1. **Backend:**
   - Setup inicial do projeto (seguir estrutura GitSpread)
   - Configuração MikroORM + PostgreSQL (Supabase)
   - User Context: cadastro, login JWT
   - Product Context: entities, repositories
   - Integração Bling API: sincronização de produtos (cron)
   - Integração Magis5: sincronização de imagens
   - Controllers REST para produtos (CRUD, search, filters)

2. **Frontend:**
   - Setup Next.js 14 + MUI
   - Configurar tema customizado (paleta amarela/azul)
   - Criar componentes base:
     - Header (amarelo, estilo ML)
     - Footer
     - SearchBar com autocomplete
     - LoadingSkeleton
   - Página inicial (homepage):
     - Hero banner (carrossel)
     - Grid de categorias (cards visuais)
     - Grid de produtos em destaque (4 colunas desktop)
   - Listagem de produtos:
     - FilterSidebar (desktop) / FilterDrawer (mobile)
     - ProductGrid responsivo
     - ProductCard (hover effects, badges)
     - Paginação
   - Página de detalhes do produto:
     - ProductGallery com zoom
     - PriceDisplay com desconto e parcelamento
     - ShippingCalculator
     - Descrição completa
   - Sistema de busca:
     - Autocomplete com sugestões
     - Filtros dinâmicos
   - Layout responsivo (mobile-first)
   - Skeleton loading durante carregamento

**Visual Guidelines:**
   - Seguir paleta de cores da seção 2.2
   - Usar componentes do design system (seção 3.4)
   - Animações suaves (0.2s ease-in-out)
   - Cards com sombra em hover
   - Badges coloridos (frete grátis verde, descontos vermelhos)

**Entregáveis:**
- ✅ Catálogo de produtos funcional
- ✅ Sincronização automática Bling → Sistema
- ✅ Sincronização de imagens Magis5
- ✅ Busca e filtros
- ✅ Autenticação básica (JWT)

---

### FASE 2: Sistema de Cadastro + Assinatura

**Objetivo:** Revendedores podem se cadastrar e assinar

**Bounded Contexts:**
- Reseller Context (completo)
- Subscription Context (completo)

**Implementar:**

1. **Backend:**
   - Reseller Context: entities, use cases
   - Fluxo de aprovação de cadastro (admin)
   - Geração de links únicos
   - Integração Cielo Recorrência
   - Webhook Cielo para pagamentos
   - Cron job para cobranças mensais
   - Notificações por email (opcional)

2. **Frontend:**
   - Página de cadastro de revendedor:
     - Formulário em steps (dados pessoais → dados bancários → confirmação)
     - Validações visuais (yup + react-hook-form)
     - Feedback visual de sucesso/erro
     - Design clean e confiável
   - Painel admin para aprovação:
     - Tabela de cadastros pendentes
     - Modal de detalhes do revendedor
     - Botões de aprovar/rejeitar com confirmação
     - Filtros e busca
   - Área do revendedor (layout base):
     - Sidebar com menu (estilo Amazon Seller)
     - Header com badge de nível (bronze/prata/ouro)
     - AffiliateLink component (copy + QR code)
     - Dashboard básico:
       - Cards de métricas (vendas R$ 0,00, comissões, visitas)
       - Visual limpo com ícones Material
       - Cores por status (verde=bom, amarelo=atenção, vermelho=crítico)
   - Tela de assinatura:
     - Planos destacados (card atual em amarelo)
     - Integração com formulário Cielo
     - Feedback visual de processamento
     - Confirmação de pagamento

**Visual Guidelines:**
   - Dashboard com sidebar fixa (desktop)
   - Cards de métrica com ícones grandes
   - Badge de nível com gradiente (bronze/prata/ouro)
   - Link de afiliado em destaque (box amarelo)
   - Gráficos com cores da paleta principal

**Entregáveis:**
- ✅ Cadastro de revendedores
- ✅ Aprovação manual por admin
- ✅ Assinatura mensal via Cielo
- ✅ Renovação automática
- ✅ Links únicos gerados

---

### FASE 3: Links de Afiliado + Rastreamento

**Objetivo:** Rastrear visitas e vendas por revendedor

**Bounded Contexts:**
- Analytics Context (completo)
- Atualizar Order Context para vincular revendedor

**Implementar:**

1. **Backend:**
   - Sistema de tracking de visitas (cookies/session)
   - Vincular pedidos ao revendedor via link
   - Analytics: use cases para métricas
   - API endpoints para dashboard do revendedor

2. **Frontend:**
   - Middleware para capturar parâmetro do link único
   - Cookie/localStorage para persistir revendedor na sessão
   - Dashboard do revendedor: visitas, leads, conversões

**Entregáveis:**
- ✅ Tracking de visitas por link único
- ✅ Atribuição de pedidos ao revendedor
- ✅ Métricas básicas no dashboard

---

### FASE 4: Dashboard do Revendedor

**Objetivo:** Interface completa para o revendedor acompanhar vendas

**Implementar:**

1. **Frontend:**
   - Dashboard completo do revendedor:
     - **Hero Section:**
       - Saudação personalizada ("Olá, [Nome]!")
       - Badge de nível animado (bronze/prata/ouro)
       - Progress bar para próximo nível
       - Link único em destaque (copy button + QR code)
     
     - **Cards de Métricas (Grid 4 colunas desktop, 2 mobile):**
       - Total Vendido (ícone carrinho, cor azul)
       - Comissão Total (ícone dinheiro, cor verde)
       - Visitas ao Link (ícone olho, cor laranja)
       - Taxa de Conversão (ícone gráfico, cor roxa)
       - Cada card com:
         - Ícone grande à esquerda
         - Valor principal em destaque
         - Trend indicator (↑↓ com %)
         - Comparação com período anterior
     
     - **Gráficos (usando Recharts ou Chart.js):**
       - Line Chart: Vendas ao longo do tempo (últimos 30 dias)
         - Linha amarela para vendas
         - Área preenchida com gradiente
         - Tooltips com valores
       - Bar Chart: Vendas por categoria (top 5)
         - Barras horizontais coloridas
         - Labels com valores
       - Donut Chart: Distribuição de comissões (pendentes vs disponíveis)
         - Verde para disponível
         - Amarelo para pendente
         - Cinza para já sacado
     
     - **Tabelas:**
       - Histórico de vendas (últimas 10):
         - Data, Produto, Valor, Comissão, Status
         - Cores por status (pago=verde, pendente=amarelo)
         - Paginação estilo ML
       - Comissões disponíveis:
         - Valor acumulado em destaque
         - Botão "Solicitar Saque" (verde, grande)
         - Lista de comissões detalhada
     
     - **Links Rápidos:**
       - Grid de ações rápidas (ícones grandes):
         - Ver Produtos (ícone sacola)
         - Materiais de Marketing (ícone imagem)
         - Meus Cupons (ícone ticket)
         - Configurações (ícone engrenagem)
   
   - **QR Code Generator:**
     - Modal com QR code do link único
     - Botão para download (PNG)
     - Opções de tamanho (pequeno/médio/grande)
     - Branding (logo Kaza Tem no centro)

**Estilo Visual:**
   - Layout inspirado em Amazon Seller Central
   - Cards brancos com sombra sutil
   - Hover effects suaves
   - Ícones Material (filled para ações primárias)
   - Tipografia hierarquizada (números grandes, labels pequenos)
   - Espaçamento generoso (não poluído)
   - Mobile-first (stack vertical em telas pequenas)

**Entregáveis:**
- ✅ Dashboard completo e funcional
- ✅ Visualização de métricas em tempo real
- ✅ Histórico detalhado

---

### FASE 5: Sistema de Comissões

**Objetivo:** Calcular comissões automaticamente

**Bounded Contexts:**
- Commission Context (completo)

**Implementar:**

1. **Backend:**
   - Commission Rules configuráveis (admin)
   - Cálculo automático ao confirmar pedido pago
   - Evento OrderPaid → CalculateCommission
   - Regra de disponibilização (após X dias)
   - APIs para consulta de saldo e histórico

2. **Frontend:**
   - Painel admin: configurar regras de comissão
   - Dashboard revendedor: saldo disponível/pendente
   - Histórico de comissões

**Entregáveis:**
- ✅ Cálculo automático de comissões
- ✅ Regras graduais configuráveis
- ✅ Saldo pendente vs disponível

---

### FASE 6: Sistema de Saques

**Objetivo:** Revendedores podem solicitar saques

**Bounded Contexts:**
- Withdrawal Context (completo)

**Implementar:**

1. **Backend:**
   - Solicitar saque (validar saldo mínimo)
   - Fluxo de aprovação manual (admin)
   - Integração Bling: criar conta a pagar
   - Webhook ou atualização manual quando pago

2. **Frontend:**
   - Formulário de solicitação de saque
   - Cadastro de dados bancários
   - Histórico de saques
   - Painel admin: aprovar/rejeitar saques

**Entregáveis:**
- ✅ Solicitação de saques
- ✅ Aprovação manual
- ✅ Integração com Bling (contas a pagar)

---

### FASE 7: Integração Bling (Completa)

**Objetivo:** Integração 100% bidirecional

**Implementar:**

1. **Backend:**
   - Webhook Bling: atualização de estoque
   - Webhook Bling: status de pedidos
   - Criar pedidos no Bling ao confirmar pagamento
   - Sincronizar status de envio

2. **Frontend:**
   - (Nenhuma mudança significativa)

**Entregáveis:**
- ✅ Pedidos criados automaticamente no Bling
- ✅ Estoque sincronizado em tempo real
- ✅ Status de envio atualizado

---

### FASE 8: Funcionalidades Adicionais

**Implementar:**

1. **Marketing Materials:**
   - Upload de banners/posts (admin)
   - Download de materiais (revendedor)

2. **Cupons Personalizados:**
   - Criar cupons por revendedor
   - Validação no checkout

3. **Preços Customizados:**
   - Admin habilita para revendedor específico
   - Revendedor pode aumentar preços

4. **Níveis de Revendedor:**
   - Cálculo automático baseado em faturamento anual
   - Badges no dashboard

**Entregáveis:**
- ✅ Materiais de marketing
- ✅ Sistema de cupons
- ✅ Preços customizados (opcional)
- ✅ Níveis de revendedor

---

## 8. ESPECIFICAÇÕES DETALHADAS POR CONTEXT

### 8.1 Product Context - Especificação Completa

#### Domain Layer

**Entity: Product**

```typescript
// src/contexts/product/domain/entities/product.entity.ts
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

**Value Object: SKU**

```typescript
// src/contexts/product/domain/value-objects/sku.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidSKUException } from '../exceptions/invalid-sku.exception';

interface SKUProps {
  value: string;
}

export class SKU extends ValueObject<SKUProps> {
  private constructor(props: SKUProps) {
    super(props);
  }

  static create(sku: string): SKU {
    if (!sku || sku.trim().length === 0) {
      throw new InvalidSKUException('SKU cannot be empty');
    }

    if (sku.length > 100) {
      throw new InvalidSKUException('SKU cannot exceed 100 characters');
    }

    return new SKU({ value: sku.trim().toUpperCase() });
  }

  get value(): string {
    return this.props.value;
  }
}
```

**Value Object: Price**

```typescript
// src/contexts/product/domain/value-objects/price.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidPriceException } from '../exceptions/invalid-price.exception';

interface PriceProps {
  amount: number;
}

export class Price extends ValueObject<PriceProps> {
  private constructor(props: PriceProps) {
    super(props);
  }

  static create(amount: number): Price {
    if (amount < 0) {
      throw new InvalidPriceException('Price cannot be negative');
    }

    // Arredondar para 2 casas decimais
    const roundedAmount = Math.round(amount * 100) / 100;

    return new Price({ amount: roundedAmount });
  }

  get value(): number {
    return this.props.amount;
  }

  add(other: Price): Price {
    return Price.create(this.value + other.value);
  }

  subtract(other: Price): Price {
    return Price.create(this.value - other.value);
  }

  multiply(factor: number): Price {
    return Price.create(this.value * factor);
  }
}
```

**Value Object: Stock**

```typescript
// src/contexts/product/domain/value-objects/stock.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidStockException } from '../exceptions/invalid-stock.exception';

interface StockProps {
  quantity: number;
}

export class Stock extends ValueObject<StockProps> {
  private constructor(props: StockProps) {
    super(props);
  }

  static create(quantity: number): Stock {
    if (quantity < 0) {
      throw new InvalidStockException('Stock cannot be negative');
    }

    if (!Number.isInteger(quantity)) {
      throw new InvalidStockException('Stock must be an integer');
    }

    return new Stock({ quantity });
  }

  get value(): number {
    return this.props.quantity;
  }

  isAvailable(requestedQuantity: number): boolean {
    return this.value >= requestedQuantity;
  }

  decrease(quantity: number): Stock {
    return Stock.create(this.value - quantity);
  }

  increase(quantity: number): Stock {
    return Stock.create(this.value + quantity);
  }
}
```

**Domain Event: ProductCreatedEvent**

```typescript
// src/contexts/product/domain/events/product-created.event.ts
import { DomainEvent } from '@gitspread/domain-primitives';

export class ProductCreatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly sku: string,
    public readonly name: string,
  ) {
    super();
  }

  get aggregateId(): string {
    return this.productId;
  }
}
```

#### Application Layer

**Repository Port:**

```typescript
// src/contexts/product/application/ports/output/product-repository.port.ts
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

**Use Case: SyncProductsFromBling**

```typescript
// src/contexts/product/application/use-cases/sync-products-from-bling/sync-products-from-bling.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../ports/output/product-repository.port';
import { BLING_CLIENT, BlingClientPort } from '../../../../infrastructure/integrations/bling/bling-client.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { Product } from '../../../domain/entities/product.entity';
import { SKU } from '../../../domain/value-objects/sku.vo';
import { Price } from '../../../domain/value-objects/price.vo';
import { Stock } from '../../../domain/value-objects/stock.vo';

export class SyncProductsCommand {
  constructor(public readonly fullSync: boolean = false) {}
}

export interface SyncProductsResult {
  created: number;
  updated: number;
  errors: string[];
}

@Injectable()
export class SyncProductsFromBlingUseCase
  implements UseCase<SyncProductsCommand, SyncProductsResult>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
    @Inject(BLING_CLIENT)
    private readonly blingClient: BlingClientPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: SyncProductsCommand): Promise<SyncProductsResult> {
    const result: SyncProductsResult = {
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Buscar produtos do Bling
      const blingProducts = await this.blingClient.getProducts();

      for (const blingProduct of blingProducts) {
        try {
          await this.syncProduct(blingProduct, result);
        } catch (error) {
          result.errors.push(
            `Error syncing product ${blingProduct.codigo}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      result.errors.push(`Error fetching products from Bling: ${error.message}`);
    }

    return result;
  }

  private async syncProduct(
    blingProduct: any,
    result: SyncProductsResult,
  ): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const sku = SKU.create(blingProduct.codigo);
      const existingProduct = await this.productRepository.findBySKU(sku);

      if (existingProduct) {
        // Atualizar produto existente
        existingProduct.updatePrice(Price.create(blingProduct.preco));
        existingProduct.updateStock(Stock.create(blingProduct.estoqueAtual));
        await this.productRepository.save(existingProduct);
        result.updated++;
      } else {
        // Criar novo produto
        const product = Product.create(
          blingProduct.id,
          sku,
          blingProduct.descricao,
          blingProduct.descricaoComplementar || '',
          Price.create(blingProduct.preco),
          Price.create(blingProduct.precoCusto || 0),
          Stock.create(blingProduct.estoqueAtual || 0),
        );
        await this.productRepository.save(product);
        result.created++;
      }
    });
  }
}
```

**Use Case: GetProductById**

```typescript
// src/contexts/product/application/use-cases/get-product/get-product.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PRODUCT_REPOSITORY, ProductRepositoryPort } from '../../ports/output/product-repository.port';
import { ProductDto } from '../../dto/product.dto';
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { ProductNotFoundException } from '../../../domain/exceptions/product-not-found.exception';

export class GetProductQuery {
  constructor(public readonly productId: string) {}
}

@Injectable()
export class GetProductByIdUseCase
  implements UseCase<GetProductQuery, ProductDto>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async execute(query: GetProductQuery): Promise<ProductDto> {
    const productId = ProductId.from(query.productId);
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new ProductNotFoundException(query.productId);
    }

    return ProductDto.fromDomain(product);
  }
}
```

**DTO: ProductDto**

```typescript
// src/contexts/product/application/dto/product.dto.ts
import { Product } from '../../domain/entities/product.entity';

export class ProductDto {
  id: string;
  blingId: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number;
  categoryId: string | null;
  isActive: boolean;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;

  static fromDomain(product: Product): ProductDto {
    const dto = new ProductDto();
    dto.id = product.id.value;
    dto.blingId = product.blingId;
    dto.sku = product.sku.value;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price.value;
    dto.costPrice = product.costPrice.value;
    dto.stock = product.stock.value;
    dto.categoryId = product.categoryId;
    dto.isActive = product.isActive;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
```

#### Infrastructure Layer

**ORM Entity:**

```typescript
// src/infrastructure/persistence/mikro-orm/entities/product-orm.entity.ts
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

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt: Date;

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date;
}
```

**Repository Implementation:**

```typescript
// src/infrastructure/persistence/mikro-orm/repositories/product.repository.ts
import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { ProductRepositoryPort, ProductFilters } from '../../../../contexts/product/application/ports/output/product-repository.port';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';
import { SKU } from '../../../../contexts/product/domain/value-objects/sku.vo';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductMapper } from '../mappers/product.mapper';
import { EVENT_PUBLISHER, EventPublisherPort } from '../../ports/event-publisher.port';
import { Inject } from '@nestjs/common';

@Injectable()
export class MikroOrmProductRepository implements ProductRepositoryPort {
  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly repository: EntityRepository<ProductOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: ProductMapper,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisherPort,
  ) {}

  async save(product: Product): Promise<Product> {
    const ormEntity = this.mapper.toOrm(product);
    await this.em.persistAndFlush(ormEntity);

    // Publicar eventos de domínio
    const events = product.pullDomainEvents();
    await this.eventPublisher.publishAll(events);

    return this.mapper.toDomain(ormEntity);
  }

  async findById(id: ProductId): Promise<Product | null> {
    const ormEntity = await this.repository.findOne({ id: id.value });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async findBySKU(sku: SKU): Promise<Product | null> {
    const ormEntity = await this.repository.findOne({ sku: sku.value });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async findByBlingId(blingId: string): Promise<Product | null> {
    const ormEntity = await this.repository.findOne({ blingId });
    return ormEntity ? this.mapper.toDomain(ormEntity) : null;
  }

  async findAll(filters?: ProductFilters): Promise<Product[]> {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.minPrice !== undefined) {
      where.price = { $gte: filters.minPrice };
    }
    if (filters?.maxPrice !== undefined) {
      where.price = { ...where.price, $lte: filters.maxPrice };
    }
    if (filters?.inStock) {
      where.stock = { $gt: 0 };
    }

    const ormEntities = await this.repository.find(where, {
      limit: filters?.limit,
      offset: filters?.offset,
    });

    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    const ormEntities = await this.repository.find({ categoryId, isActive: true });
    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }

  async searchByName(query: string): Promise<Product[]> {
    const ormEntities = await this.repository.find({
      name: { $like: `%${query}%` },
      isActive: true,
    });
    return ormEntities.map((entity) => this.mapper.toDomain(entity));
  }

  async delete(id: ProductId): Promise<void> {
    await this.repository.nativeDelete({ id: id.value });
  }
}
```

**Mapper:**

```typescript
// src/infrastructure/persistence/mikro-orm/mappers/product.mapper.ts
import { Injectable } from '@nestjs/common';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';
import { SKU } from '../../../../contexts/product/domain/value-objects/sku.vo';
import { Price } from '../../../../contexts/product/domain/value-objects/price.vo';
import { Stock } from '../../../../contexts/product/domain/value-objects/stock.vo';

@Injectable()
export class ProductMapper {
  toDomain(orm: ProductOrmEntity): Product {
    return Product.reconstitute(
      ProductId.from(orm.id),
      orm.blingId,
      SKU.create(orm.sku),
      orm.name,
      orm.description || '',
      Price.create(orm.price),
      Price.create(orm.costPrice || 0),
      Stock.create(orm.stock),
      orm.categoryId || null,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Product): ProductOrmEntity {
    const orm = new ProductOrmEntity();
    orm.id = domain.id.value;
    orm.blingId = domain.blingId;
    orm.sku = domain.sku.value;
    orm.name = domain.name;
    orm.description = domain.description;
    orm.price = domain.price.value;
    orm.costPrice = domain.costPrice.value;
    orm.stock = domain.stock.value;
    orm.categoryId = domain.categoryId;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
```

**Controller:**

```typescript
// src/infrastructure/http/controllers/product/product.controller.ts
import { Controller, Get, Param, Query, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { GetProductByIdUseCase, GetProductQuery } from '../../../../contexts/product/application/use-cases/get-product/get-product.use-case';
import { SearchProductsUseCase, SearchProductsQuery } from '../../../../contexts/product/application/use-cases/search-products/search-products.use-case';
import { SyncProductsFromBlingUseCase, SyncProductsCommand } from '../../../../contexts/product/application/use-cases/sync-products-from-bling/sync-products-from-bling.use-case';
import { ProductResponseDto } from './dto/product-response.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('products')
export class ProductController {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly searchProductsUseCase: SearchProductsUseCase,
    private readonly syncProductsUseCase: SyncProductsFromBlingUseCase,
  ) {}

  @Get(':id')
  async getProduct(@Param('id') id: string): Promise<ProductResponseDto> {
    const query = new GetProductQuery(id);
    const productDto = await this.getProductByIdUseCase.execute(query);
    return ProductResponseDto.fromDto(productDto);
  }

  @Get()
  async searchProducts(
    @Query('q') searchTerm?: string,
    @Query('category') categoryId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ProductResponseDto[]> {
    const query = new SearchProductsQuery({
      searchTerm,
      categoryId,
      minPrice,
      maxPrice,
      limit,
      offset,
    });
    const products = await this.searchProductsUseCase.execute(query);
    return products.map(ProductResponseDto.fromDto);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async syncProducts(@Body('fullSync') fullSync: boolean = false) {
    const command = new SyncProductsCommand(fullSync);
    return this.syncProductsUseCase.execute(command);
  }
}
```

**Module:**

```typescript
// src/contexts/product/product.module.ts
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { PRODUCT_REPOSITORY } from './application/ports/output/product-repository.port';
import { MikroOrmProductRepository } from '../../infrastructure/persistence/mikro-orm/repositories/product.repository';
import { ProductMapper } from '../../infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { GetProductByIdUseCase } from './application/use-cases/get-product/get-product.use-case';
import { SearchProductsUseCase } from './application/use-cases/search-products/search-products.use-case';
import { SyncProductsFromBlingUseCase } from './application/use-cases/sync-products-from-bling/sync-products-from-bling.use-case';
import { BlingModule } from '../../infrastructure/integrations/bling/bling.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([ProductOrmEntity]),
    BlingModule,
  ],
  providers: [
    ProductMapper,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: MikroOrmProductRepository,
    },
    GetProductByIdUseCase,
    SearchProductsUseCase,
    SyncProductsFromBlingUseCase,
  ],
  exports: [
    GetProductByIdUseCase,
    SearchProductsUseCase,
    SyncProductsFromBlingUseCase,
  ],
})
export class ProductModule {}
```

---

### 8.2 Reseller Context - Especificação Completa

#### Domain Layer

**Entity: Reseller**

```typescript
// src/contexts/reseller/domain/entities/reseller.entity.ts
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ResellerId } from '../value-objects/reseller-id.vo';
import { UniqueLink } from '../value-objects/unique-link.vo';
import { CPF } from '../value-objects/cpf.vo';
import { Email } from '../value-objects/email.vo';
import { ResellerLevel } from '../value-objects/reseller-level.vo';
import { ResellerStatus } from '../value-objects/reseller-status.vo';
import { ResellerRegisteredEvent } from '../events/reseller-registered.event';
import { ResellerApprovedEvent } from '../events/reseller-approved.event';
import { ResellerLevelChangedEvent } from '../events/reseller-level-changed.event';

export class Reseller extends AggregateRoot {
  private constructor(
    private readonly _id: ResellerId,
    private readonly _userId: string,
    private readonly _uniqueLink: UniqueLink,
    private readonly _cpf: CPF,
    private _status: ResellerStatus,
    private _level: ResellerLevel,
    private _canSetCustomPrice: boolean,
    private _approvedAt: Date | null,
    private _approvedBy: string | null,
    private _rejectedAt: Date | null,
    private _rejectedReason: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(
    userId: string,
    uniqueLink: UniqueLink,
    cpf: CPF,
  ): Reseller {
    const reseller = new Reseller(
      ResellerId.generate(),
      userId,
      uniqueLink,
      cpf,
      ResellerStatus.pending(),
      ResellerLevel.bronze(),
      false,
      null,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );

    reseller.addDomainEvent(
      new ResellerRegisteredEvent(reseller.id.value, userId, cpf.value),
    );

    return reseller;
  }

  approve(approvedBy: string): void {
    if (!this._status.isPending()) {
      throw new Error('Only pending resellers can be approved');
    }

    this._status = ResellerStatus.active();
    this._approvedAt = new Date();
    this._approvedBy = approvedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ResellerApprovedEvent(this._id.value, this._userId),
    );
  }

  reject(reason: string): void {
    if (!this._status.isPending()) {
      throw new Error('Only pending resellers can be rejected');
    }

    this._status = ResellerStatus.rejected();
    this._rejectedAt = new Date();
    this._rejectedReason = reason;
    this._updatedAt = new Date();
  }

  upgradeLevel(newLevel: ResellerLevel): void {
    const oldLevel = this._level;
    this._level = newLevel;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ResellerLevelChangedEvent(
        this._id.value,
        oldLevel.value,
        newLevel.value,
      ),
    );
  }

  enableCustomPricing(): void {
    this._canSetCustomPrice = true;
    this._updatedAt = new Date();
  }

  disableCustomPricing(): void {
    this._canSetCustomPrice = false;
    this._updatedAt = new Date();
  }

  suspend(): void {
    this._status = ResellerStatus.suspended();
    this._updatedAt = new Date();
  }

  // Getters
  get id(): ResellerId { return this._id; }
  get userId(): string { return this._userId; }
  get uniqueLink(): UniqueLink { return this._uniqueLink; }
  get cpf(): CPF { return this._cpf; }
  get status(): ResellerStatus { return this._status; }
  get level(): ResellerLevel { return this._level; }
  get canSetCustomPrice(): boolean { return this._canSetCustomPrice; }
  get approvedAt(): Date | null { return this._approvedAt; }
  get approvedBy(): string | null { return this._approvedBy; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
}
```

**Value Object: UniqueLink**

```typescript
// src/contexts/reseller/domain/value-objects/unique-link.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';
import { randomBytes } from 'crypto';

interface UniqueLinkProps {
  code: string;
}

export class UniqueLink extends ValueObject<UniqueLinkProps> {
  private constructor(props: UniqueLinkProps) {
    super(props);
  }

  static generate(userName: string): UniqueLink {
    const sanitizedName = userName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 30);

    const randomCode = randomBytes(4).toString('hex').toUpperCase();

    const code = `${sanitizedName}_${randomCode}`;

    return new UniqueLink({ code });
  }

  static from(code: string): UniqueLink {
    return new UniqueLink({ code });
  }

  get value(): string {
    return this.props.code;
  }

  getFullUrl(baseUrl: string): string {
    return `${baseUrl}/r/${this.value}`;
  }
}
```

**Value Object: CPF**

```typescript
// src/contexts/reseller/domain/value-objects/cpf.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidCPFException } from '../exceptions/invalid-cpf.exception';

interface CPFProps {
  value: string;
}

export class CPF extends ValueObject<CPFProps> {
  private constructor(props: CPFProps) {
    super(props);
  }

  static create(cpf: string): CPF {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) {
      throw new InvalidCPFException('CPF must have 11 digits');
    }

    if (!CPF.isValid(cleaned)) {
      throw new InvalidCPFException('Invalid CPF');
    }

    return new CPF({ value: cleaned });
  }

  private static isValid(cpf: string): boolean {
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) {
      return false;
    }

    // Validar dígitos verificadores
    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  }

  get value(): string {
    return this.props.value;
  }

  format(): string {
    const cpf = this.props.value;
    return `${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.substring(9, 11)}`;
  }
}
```

**Value Object: ResellerLevel**

```typescript
// src/contexts/reseller/domain/value-objects/reseller-level.vo.ts
import { ValueObject } from '@gitspread/domain-primitives';

type ResellerLevelType = 'bronze' | 'silver' | 'gold';

interface ResellerLevelProps {
  level: ResellerLevelType;
}

export class ResellerLevel extends ValueObject<ResellerLevelProps> {
  private constructor(props: ResellerLevelProps) {
    super(props);
  }

  static bronze(): ResellerLevel {
    return new ResellerLevel({ level: 'bronze' });
  }

  static silver(): ResellerLevel {
    return new ResellerLevel({ level: 'silver' });
  }

  static gold(): ResellerLevel {
    return new ResellerLevel({ level: 'gold' });
  }

  static from(level: string): ResellerLevel {
    switch (level) {
      case 'bronze':
        return ResellerLevel.bronze();
      case 'silver':
        return ResellerLevel.silver();
      case 'gold':
        return ResellerLevel.gold();
      default:
        throw new Error(`Invalid reseller level: ${level}`);
    }
  }

  get value(): ResellerLevelType {
    return this.props.level;
  }

  isBronze(): boolean {
    return this.props.level === 'bronze';
  }

  isSilver(): boolean {
    return this.props.level === 'silver';
  }

  isGold(): boolean {
    return this.props.level === 'gold';
  }
}
```

#### Application Layer

**Use Case: RegisterReseller**

```typescript
// src/contexts/reseller/application/use-cases/register-reseller/register-reseller.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { RESELLER_REPOSITORY, ResellerRepositoryPort } from '../../ports/output/reseller-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../user/application/ports/output/user-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { Reseller } from '../../../domain/entities/reseller.entity';
import { UniqueLink } from '../../../domain/value-objects/unique-link.vo';
import { CPF } from '../../../domain/value-objects/cpf.vo';
import { ResellerDto } from '../../dto/reseller.dto';
import { ResellerAlreadyExistsException } from '../../../domain/exceptions/reseller-already-exists.exception';

export class RegisterResellerCommand {
  constructor(
    public readonly userId: string,
    public readonly cpf: string,
    public readonly fullName: string,
  ) {}
}

@Injectable()
export class RegisterResellerUseCase
  implements UseCase<RegisterResellerCommand, ResellerDto>
{
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterResellerCommand): Promise<ResellerDto> {
    // Verificar se já existe revendedor para esse usuário
    const existingReseller = await this.resellerRepository.findByUserId(
      command.userId,
    );
    if (existingReseller) {
      throw new ResellerAlreadyExistsException('User is already a reseller');
    }

    // Verificar se CPF já está cadastrado
    const cpfVO = CPF.create(command.cpf);
    const existingByCPF = await this.resellerRepository.findByCPF(cpfVO);
    if (existingByCPF) {
      throw new ResellerAlreadyExistsException('CPF already registered');
    }

    // Gerar link único
    const uniqueLink = UniqueLink.generate(command.fullName);

    // Verificar se link já existe (improvável mas possível)
    let link = uniqueLink;
    let attempts = 0;
    while (await this.resellerRepository.findByUniqueLink(link)) {
      link = UniqueLink.generate(`${command.fullName}${attempts}`);
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique link');
      }
    }

    // Criar reseller
    const reseller = Reseller.create(command.userId, link, cpfVO);

    // Salvar
    return this.unitOfWork.execute(async () => {
      const savedReseller = await this.resellerRepository.save(reseller);
      return ResellerDto.fromDomain(savedReseller);
    });
  }
}
```

**Use Case: ApproveResellerRegistration**

```typescript
// src/contexts/reseller/application/use-cases/approve-reseller/approve-reseller.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { RESELLER_REPOSITORY, ResellerRepositoryPort } from '../../ports/output/reseller-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';

export class ApproveResellerCommand {
  constructor(
    public readonly resellerId: string,
    public readonly approvedBy: string,
  ) {}
}

@Injectable()
export class ApproveResellerRegistrationUseCase
  implements UseCase<ApproveResellerCommand, void>
{
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ApproveResellerCommand): Promise<void> {
    const resellerId = ResellerId.from(command.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);

    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    reseller.approve(command.approvedBy);

    await this.unitOfWork.execute(async () => {
      await this.resellerRepository.save(reseller);
    });
  }
}
```

---

## 9. APIS E ENDPOINTS

### 9.1 Backend API (REST)

**Base URL:** `http://localhost:3000/api`

#### Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

#### Products

```
GET    /api/products                 # Listar produtos (com filtros)
GET    /api/products/:id             # Detalhes do produto
GET    /api/products/sku/:sku        # Buscar por SKU
POST   /api/products/sync            # Admin: Sincronizar do Bling
GET    /api/categories               # Listar categorias
```

#### Resellers

```
POST   /api/resellers/register       # Cadastrar como revendedor
GET    /api/resellers/me             # Dados do revendedor logado
GET    /api/resellers/dashboard      # Dashboard do revendedor
POST   /api/resellers/:id/approve    # Admin: Aprovar cadastro
POST   /api/resellers/:id/reject     # Admin: Rejeitar cadastro
PATCH  /api/resellers/:id/custom-pricing  # Admin: Habilitar preços customizados
```

#### Subscriptions

```
POST   /api/subscriptions            # Criar assinatura (Cielo)
GET    /api/subscriptions/me         # Minha assinatura
POST   /api/subscriptions/cancel     # Cancelar assinatura
POST   /api/subscriptions/webhook    # Webhook Cielo
```

#### Orders

```
POST   /api/orders                   # Criar pedido
GET    /api/orders/:id               # Detalhes do pedido
GET    /api/orders/my-orders         # Meus pedidos (cliente)
POST   /api/orders/:id/payment       # Processar pagamento (Cielo)
POST   /api/orders/webhook           # Webhook Cielo
POST   /api/orders/:id/calculate-shipping  # Calcular frete
```

#### Commissions

```
GET    /api/commissions/balance      # Saldo de comissões
GET    /api/commissions/history      # Histórico de comissões
GET    /api/commissions/rules        # Regras de comissionamento
POST   /api/commissions/rules        # Admin: Configurar regras
```

#### Withdrawals

```
POST   /api/withdrawals              # Solicitar saque
GET    /api/withdrawals/my-withdrawals  # Meus saques
POST   /api/withdrawals/:id/approve  # Admin: Aprovar saque
POST   /api/withdrawals/:id/reject   # Admin: Rejeitar saque
```

#### Marketing

```
GET    /api/marketing/materials      # Listar materiais
POST   /api/marketing/materials      # Admin: Upload material
GET    /api/coupons                  # Listar cupons
POST   /api/coupons                  # Criar cupom
POST   /api/coupons/validate         # Validar cupom
```

#### Analytics

```
POST   /api/analytics/visit          # Registrar visita
POST   /api/analytics/lead           # Registrar lead
GET    /api/analytics/reseller-stats # Estatísticas do revendedor
```

---

## 10. REGRAS DE NEGÓCIO

### 10.1 Comissionamento

**Regra 1: Cálculo da Base de Comissão**
- Base = Total do Pedido - Frete
- Comissão = Base × Percentual

**Regra 2: Percentual Gradual Mensal**
```
Exemplo de configuração:
R$ 0 - R$ 1.000 = 10%
R$ 1.001 - R$ 2.000 = 15%
R$ 2.001 - R$ 5.000 = 20%
R$ 5.001+ = 25%
```

**Regra 3: Período de Disponibilização**
- Comissão fica "pending" por X dias (configurável, ex: 30 dias)
- Após X dias, status muda para "available"
- Somente comissões "available" podem ser sacadas

**Regra 4: Reset Mensal**
- No dia 1º de cada mês, o contador de vendas mensais reseta
- Percentual volta para a primeira faixa

### 10.2 Níveis de Revendedor

**Bronze:**
- Faturamento anual: R$ 0 - R$ 50.000
- Benefícios: Materiais básicos

**Prata:**
- Faturamento anual: R$ 50.001 - R$ 150.000
- Benefícios: Materiais premium + brindes semestrais

**Ouro:**
- Faturamento anual: R$ 150.001+
- Benefícios: Materiais exclusivos + brindes trimestrais + eventos

**Cálculo:**
- Faturamento anual = soma das comissões nos últimos 12 meses
- Atualização: primeira semana de cada mês (cron job)

### 10.3 Saques

**Requisitos:**
- Saldo mínimo: configurável (ex: R$ 50,00)
- Status da assinatura: ativa
- Dados bancários cadastrados

**Fluxo:**
1. Revendedor solicita saque
2. Admin aprova/rejeita manualmente
3. Se aprovado, cria conta a pagar no Bling
4. Após pagamento no Bling, admin marca como "paid" no sistema

### 10.4 Preços Customizados

**Regra:**
- Por padrão, revendedor vende pelos preços do site
- Admin pode habilitar "custom pricing" para revendedor específico
- Revendedor só pode AUMENTAR preços, nunca reduzir
- Comissão sempre calculada sobre preço base do site

---

## 11. FLUXOS COMPLETOS

### 11.1 Fluxo de Cadastro de Revendedor

```
1. Usuário acessa /reseller/register
2. Preenche formulário (nome, CPF, email, senha, dados bancários)
3. Sistema valida dados
4. Sistema cria User (role: reseller)
5. Sistema cria Reseller (status: pending)
6. Sistema gera UniqueLink
7. Email de confirmação enviado
8. Admin recebe notificação de novo cadastro
9. Admin acessa painel e aprova/rejeita
10. Se aprovado:
    - Status muda para "approved"
    - Email de boas-vindas enviado
    - Redireciona para criar assinatura
11. Revendedor cria assinatura via Cielo
12. Após pagamento confirmado, status muda para "active"
```

### 11.2 Fluxo de Compra com Revendedor

```
1. Cliente clica no link do revendedor: kazatem.shop/r/PAULO_ABCD1234
2. Sistema registra visita (Analytics)
3. Cookie/Session armazena reseller_id
4. Cliente navega pelo catálogo
5. Adiciona produtos ao carrinho
6. Vai para checkout
7. Informa endereço de entrega
8. Sistema calcula frete (Melhor Envio)
9. Cliente escolhe método de pagamento (Cielo)
10. Sistema cria Order vinculado ao reseller_id
11. Cliente confirma pagamento
12. Webhook Cielo notifica pagamento
13. Sistema:
    - Atualiza Order status para "paid"
    - Cria pedido no Bling
    - Calcula comissão
    - Cria Commission (status: pending)
    - Envia email de confirmação
14. Após 30 dias:
    - Cron job atualiza Commission para "available"
15. Revendedor vê saldo disponível no dashboard
```

### 11.3 Fluxo de Saque

```
1. Revendedor acessa dashboard
2. Vê saldo disponível para saque
3. Clica em "Solicitar Saque"
4. Confirma dados bancários
5. Sistema valida saldo mínimo
6. Sistema cria Withdrawal (status: requested)
7. Admin recebe notificação
8. Admin acessa painel de saques pendentes
9. Admin analisa e aprova/rejeita
10. Se aprovado:
    - Status muda para "approved"
    - Sistema cria conta a pagar no Bling
    - Admin processa pagamento externamente
11. Admin marca saque como "paid" no sistema
12. Status das comissões muda para "withdrawn"
13. Email de confirmação enviado ao revendedor
```

---

## 12. CONFIGURAÇÕES E VARIÁVEIS

### 12.1 Variáveis de Ambiente (Backend)

```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
# Ou use direto do Supabase Dashboard > Settings > Database > Connection string

# Supabase
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # Backend only!

# JWT (se usar Supabase Auth, pode reutilizar o JWT_SECRET do Supabase)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Bling Integration
BLING_CLIENT_ID=your_bling_client_id
BLING_CLIENT_SECRET=your_bling_client_secret
BLING_REDIRECT_URI=http://localhost:3000/api/integrations/bling/callback
BLING_API_URL=https://www.bling.com.br/Api/v3

# Magis5 Integration
MAGIS5_API_URL=https://api.magis5.com
MAGIS5_API_KEY=your_magis5_api_key

# Cielo
CIELO_MERCHANT_ID=your_merchant_id
CIELO_MERCHANT_KEY=your_merchant_key
CIELO_API_URL=https://api.cieloecommerce.cielo.com.br
CIELO_QUERY_URL=https://apiquery.cieloecommerce.cielo.com.br
CIELO_RECURRENCE_URL=https://api.cieloecommerce.cielo.com.br/1/RecurrentPayment

# Melhor Envio
MELHOR_ENVIO_API_URL=https://melhorenvio.com.br/api/v2
MELHOR_ENVIO_TOKEN=your_melhor_envio_token

# Application
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
PORT=3000
NODE_ENV=development

# System Config (valores padrão, sobrescritos pelo DB)
SUBSCRIPTION_PRICE=9.90
WITHDRAWAL_MIN_AMOUNT=50.00
WITHDRAWAL_RELEASE_DAYS=30
```

### 12.2 Variáveis de Ambiente (Frontend)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=Kaza Tem Imports

# Supabase (Frontend - apenas chaves públicas)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 13. INSTRUÇÕES PARA CLAUDE CODE

### 13.1 Setup Inicial

**IMPORTANTE: Siga esta ordem exatamente**

1. **Criar estrutura de diretórios**
   ```bash
   mkdir -p apps/kaza-tem-system/backend apps/kaza-tem-system/frontend
   ```

2. **Backend Setup**
   ```bash
   cd apps/kaza-tem-system/backend
   npm init -y
   # Copiar package.json do system-example e adaptar
   # Instalar dependências PostgreSQL
   npm install @mikro-orm/core @mikro-orm/postgresql @mikro-orm/nestjs
   npm install pg
   # Copiar tsconfig.json, nest-cli.json
   npm install
   ```

3. **Configurar Supabase**
   - Criar conta em https://supabase.com
   - Criar novo projeto
   - Copiar credenciais (Project URL, anon key, service_role key)
   - Connection string disponível em: Settings > Database > Connection string
   - Configurar .env com as credenciais

4. **Configurar MikroORM para PostgreSQL**
   ```typescript
   // src/infrastructure/persistence/mikro-orm/config/mikro-orm.config.ts
   import { defineConfig } from '@mikro-orm/postgresql';
   
   export default defineConfig({
     dbName: 'postgres',
     clientUrl: process.env.DATABASE_URL,
     entities: ['./dist/**/*.entity.js'],
     entitiesTs: ['./src/**/*.entity.ts'],
     migrations: {
       path: './dist/infrastructure/persistence/mikro-orm/migrations',
       pathTs: './src/infrastructure/persistence/mikro-orm/migrations',
     },
   });
   ```
   - Criar primeira migration (users table)

5. **Implementar User Context primeiro**
   - Necessário para autenticação
   - Tabela users + JWT
   - Opcional: Integrar com Supabase Auth (ou usar JWT próprio)

6. **Frontend Setup**
   ```bash
   cd apps/kaza-tem-system/frontend
   npx create-next-app@14 . --typescript --app --tailwind --no-src-dir
   npm install @mui/material @emotion/react @emotion/styled
   npm install styled-components
   npm install axios react-hook-form yup @hookform/resolvers
   npm install notistack
   ```

### 13.2 Ordem de Implementação

**FASE 1: E-commerce Básico**

1. Product Context:
   - Domain entities e VOs
   - Application use cases e ports
   - Infrastructure: ORM entities, repositories, mappers
   - Controllers REST
   - Módulo NestJS

2. Frontend - Catálogo:
   - Layout base (Header, Footer)
   - Homepage com categorias
   - Listagem de produtos
   - Página de detalhes
   - Busca

3. Integração Bling:
   - Client HTTP
   - Use case SyncProducts
   - Cron job (uma vez por hora)

4. Integração Magis5:
   - Client HTTP
   - Sincronização de imagens
   - Cron job diário

**FASE 2: Revendedores**

1. Reseller Context:
   - Domain (seguir exemplo acima)
   - Application
   - Infrastructure

2. Subscription Context:
   - Integração Cielo Recorrência
   - Webhook handler
   - Cron mensal para cobranças

3. Frontend:
   - Formulário de cadastro
   - Dashboard do revendedor
   - Painel admin

**FASE 3 a 8:** Seguir as especificações detalhadas acima

### 13.3 Comandos Úteis

```bash
# Backend
npm run dev                    # Desenvolvimento
npm run migration:create       # Criar migration
npm run migration:up           # Rodar migrations
npm test                       # Rodar testes

# Frontend
npm run dev                    # Desenvolvimento
npm run build                  # Build produção
```

### 13.4 Snippets CSS para Efeitos Visuais

#### Hover Effect em Cards (Mercado Livre Style)

```typescript
// src/components/ProductCard/styles.ts
export const ProductCardContainer = styled.div`
  transition: all 0.2s ease-in-out;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;
```

#### Badge de Desconto (Estilo ML)

```typescript
export const DiscountBadge = styled.span`
  position: absolute;
  top: 8px;
  left: 8px;
  background: #f23d4f;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  z-index: 1;
`;
```

#### Badge Frete Grátis

```typescript
export const FreeShippingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #00a650;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
`;
```

#### Preço com Desconto

```typescript
export const PriceContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 12px 0;
`;

export const OldPrice = styled.span`
  font-size: 14px;
  color: #999;
  text-decoration: line-through;
`;

export const CurrentPrice = styled.span`
  font-size: 28px;
  font-weight: 700;
  color: #333;
`;

export const InstallmentInfo = styled.span`
  font-size: 14px;
  color: #00a650;
  font-weight: 500;
`;
```

#### Botão Primário (Amarelo ML)

```typescript
export const PrimaryButton = styled.button`
  background: #ffe600;
  color: #000;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    background: #f2c94c;
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:disabled {
    background: #e5e5e5;
    color: #999;
    cursor: not-allowed;
  }
`;
```

#### Skeleton Loading (Shimmer Effect)

```typescript
import { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% {
    background-position: -468px 0;
  }
  100% {
    background-position: 468px 0;
  }
`;

export const SkeletonBox = styled.div<{ width?: string; height?: string }>`
  width: ${props => props.width || '100%'};
  height: ${props => props.height || '20px'};
  background: linear-gradient(
    to right,
    #f0f0f0 0%,
    #e0e0e0 20%,
    #f0f0f0 40%,
    #f0f0f0 100%
  );
  background-size: 936px 104px;
  animation: ${shimmer} 1.5s infinite linear;
  border-radius: 4px;
`;
```

#### Header Sticky com Sombra ao Scroll

```typescript
import { useState, useEffect } from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header<{ isScrolled: boolean }>`
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #ffe600;
  transition: box-shadow 0.3s ease-in-out;
  
  ${props => props.isScrolled && `
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `}
`;

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 0);
    }
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <HeaderContainer isScrolled={isScrolled}>
      {/* Header content */}
    </HeaderContainer>
  );
}
```

#### Badge de Nível Revendedor (Gradiente)

```typescript
const levelColors = {
  bronze: {
    from: '#CD7F32',
    to: '#8B4513',
  },
  silver: {
    from: '#C0C0C0',
    to: '#808080',
  },
  gold: {
    from: '#FFD700',
    to: '#FFA500',
  },
};

export const LevelBadge = styled.div<{ level: 'bronze' | 'silver' | 'gold' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 24px;
  background: linear-gradient(
    135deg,
    ${props => levelColors[props.level].from} 0%,
    ${props => levelColors[props.level].to} 100%
  );
  color: white;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;
```

#### Progress Bar com Animação

```typescript
const progressAnimation = keyframes`
  from {
    width: 0;
  }
  to {
    width: var(--progress);
  }
`;

export const ProgressBarContainer = styled.div`
  width: 100%;
  height: 8px;
  background: #e5e5e5;
  border-radius: 4px;
  overflow: hidden;
`;

export const ProgressBarFill = styled.div<{ progress: number }>`
  --progress: ${props => props.progress}%;
  height: 100%;
  background: linear-gradient(90deg, #00a650 0%, #00d65e 100%);
  border-radius: 4px;
  animation: ${progressAnimation} 1s ease-out forwards;
`;
```

#### Tooltip Customizado

```typescript
export const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
  
  &:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }
`;

export const TooltipContent = styled.div`
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #333;
  }
`;
```

#### Grid Responsivo de Produtos

```typescript
export const ProductGrid = styled.div`
  display: grid;
  gap: 16px;
  
  /* Mobile: 2 colunas */
  grid-template-columns: repeat(2, 1fr);
  
  /* Tablet: 3 colunas */
  @media (min-width: 600px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  /* Desktop: 4 colunas */
  @media (min-width: 960px) {
    grid-template-columns: repeat(4, 1fr);
  }
  
  /* Large: 5 colunas */
  @media (min-width: 1280px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;
```

### 13.5 Checklist de Qualidade

Para cada Context implementado, verificar:

**Backend:**
- [ ] Domain entities sem dependências de frameworks
- [ ] Value Objects imutáveis
- [ ] Domain events emitidos corretamente
- [ ] Use cases com injeção de dependência via Symbols
- [ ] Repositories implementando ports
- [ ] Mappers bidirecionais Domain ↔ ORM
- [ ] Controllers com try-catch único
- [ ] DTOs para request/response
- [ ] Módulo NestJS configurado
- [ ] Testes unitários (domain)
- [ ] Testes de integração (repositories)

**Frontend:**
- [ ] Tema MUI customizado aplicado (seção 2.10)
- [ ] Paleta de cores (seção 2.2) seguida corretamente
- [ ] Componentes seguem design system (seção 3.4)
- [ ] Hover effects implementados (translateY + box-shadow)
- [ ] Skeleton loading durante carregamento de dados
- [ ] Responsividade testada (mobile/tablet/desktop)
- [ ] Ícones Material Icons utilizados consistentemente
- [ ] Animações suaves (transition: 0.2s ease-in-out)
- [ ] Badges coloridos corretos (verde=frete, vermelho=desconto, bronze/prata/ouro=nível)
- [ ] Validação de formulários (yup + react-hook-form)
- [ ] Notificações com SnackbarContext
- [ ] Código limpo (funções declaradas, não arrow functions)
- [ ] Sem `export default` em componentes
- [ ] Tipagem TypeScript completa (evitar `any`)
- [ ] HTML semântico (section, article, nav, header, main, footer)
- [ ] Acessibilidade básica (alt em imagens, aria-labels, navegação por teclado)
- [ ] Mockups visuais (seção 3.6) respeitados
- [ ] Efeitos CSS (seção 13.4) aplicados conforme padrão

---

## 14. NOTAS FINAIS

### 14.1 Pontos de Atenção

1. **Integrações:**
   - Bling e Magis5 podem ter rate limits
   - Implementar retry logic
   - Logs detalhados de sincronização

2. **Webhooks:**
   - Validar assinaturas (Cielo)
   - Idempotência (evitar processar mesmo webhook 2x)
   - Responder rápido (< 5s)

3. **Comissões:**
   - Cron job diário para liberar comissões pendentes
   - Cron mensal para atualizar níveis de revendedores
   - Cron mensal para calcular percentuais graduais

4. **Segurança:**
   - Validar todos os inputs
   - Rate limiting nas APIs públicas
   - CORS configurado corretamente
   - Sanitização de CPF/dados sensíveis em logs

5. **Performance:**
   - Índices no banco de dados
   - Cache para listagem de produtos
   - Paginação em todas as listas

6. **Supabase:**
   - **Row Level Security (RLS):** Configurar políticas de segurança para dados sensíveis
     - Exemplo: Revendedor só acessa suas comissões
     - Admin acessa tudo
   - **Storage:** Usar Supabase Storage para materiais de marketing
     - Bucket público: Imagens de produtos (se não usar Magis5)
     - Bucket privado: Documentos de revendedores
   - **Realtime (Opcional):** Notificações em tempo real
     - Novas vendas no dashboard do revendedor
     - Status de pedidos
   - **Auth (Opcional):** Considerar usar Supabase Auth em vez de JWT próprio
     - OAuth social login (Google, Facebook)
     - Magic links
     - Recuperação de senha

### 14.2 Roadmap Futuro (Pós-MVP)

- App mobile (React Native)
- Notificações push
- Chat interno revendedor-admin
- Relatórios avançados (Power BI/Metabase)
- Gamificação (badges, rankings)
- Programa de indicação (revendedor indica revendedor)
- Multi-idiomas
- Multi-moedas (exportação)

---

**FIM DO DOCUMENTO DE REQUISITOS**

## ⚠️ LEMBRETE FINAL PARA O CODEX

**ANTES DE ESCREVER QUALQUER CÓDIGO:**

1. ✅ Leia `/mnt/project/CLAUDE.md` por completo
2. ✅ Siga os padrões de código especificados no CLAUDE.md
3. ✅ Valide seu código contra os exemplos do CLAUDE.md
4. ✅ Em caso de conflito: **CLAUDE.md tem SEMPRE precedência**

**PADRÕES CRÍTICOS (resumo do CLAUDE.md):**
- ❌ Nunca `export default` em componentes
- ❌ Nunca arrow functions para componentes
- ❌ Nunca inline styles ou className
- ❌ Nunca tipos `any`
- ❌ Nunca múltiplos `catch` em um método
- ✅ Sempre funções declaradas: `export function MyComponent()`
- ✅ Sempre styled components (um por elemento visual)
- ✅ Sempre tipagem completa TypeScript
- ✅ Sempre HTML semântico (section, article, nav, etc)
- ✅ Sempre imports `src/` (nunca relativos)
- ✅ Sempre um try-catch por controller method

Este documento serve como guia completo para implementação. Qualquer dúvida sobre especificações, consulte este arquivo.

Data: Janeiro 2025
Versão: 2.0 (Migrado para Supabase/PostgreSQL + Referência CLAUDE.md)
