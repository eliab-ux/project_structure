# GAP ANALYSIS - O QUE FALTA DESENVOLVER

**Projeto:** Kaza Tem E-commerce com Revendedores  
**Data:** Janeiro 2025  
**Status:** Análise do que foi desenvolvido vs Requisitos completos

---

## 📊 RESUMO EXECUTIVO

### ✅ O QUE JÁ FOI DESENVOLVIDO (~20% do projeto)

**Frontend Público:**
- Homepage com busca e categorias
- Cards de produtos com badges (Oferta, Novo, Mais Vendido)
- Design visual amarelo (identidade Kaza Tem)

**Portal do Revendedor (Parcial):**
- Página de cadastro (formulário básico)
- Login do revendedor
- Dashboard básico com:
  - Saudação personalizada
  - Badge de nível (Bronze)
  - Link único exibido
  - 4 cards de métricas (Total Vendido, Comissão, Visitas, Conversão)
  - Relatório rápido (3 métricas)
  - Botões: VER VENDAS, MATERIAIS DE MARKETING

### ❌ O QUE ESTÁ FALTANDO (~80% do projeto)

**CRÍTICO - NÃO IMPLEMENTADO:**
- Sistema de aprovação de cadastros (Admin)
- Sistema de assinatura mensal (Cielo Recorrência)
- Sistema de rastreamento de vendas por link
- Sistema de cálculo de comissões
- Sistema de saques
- Painel administrativo completo
- Integrações externas (Bling, Magis5, Cielo, Melhor Envio)
- Checkout funcional
- Carrinho de compras
- Gestão de produtos

---

## 1. E-COMMERCE (CLIENTE FINAL)

### 1.1 ✅ O QUE JÁ TEM

- [x] Homepage com design amarelo
- [x] Categorias em destaque (Casa, Cozinha, Tecnologia, Casa e Decoração, Ofertas)
- [x] Cards de produtos com preço
- [x] Badges visuais (Oferta, Novo, Mais Vendido)
- [x] Barra de busca (visual)
- [x] Header com ícones (carrinho, favoritos, menu)

### 1.2 ❌ O QUE FALTA DESENVOLVER

#### 1.2.1 Catálogo e Busca
- [ ] **Busca funcional** - Atualmente apenas visual
  - Buscar por nome, SKU, categoria
  - Autocomplete com sugestões
  - Filtros (preço, categoria, disponibilidade)
  
- [ ] **Página de listagem de produtos**
  - Grid responsivo (2/3/4 colunas)
  - Filtros laterais (sidebar desktop / drawer mobile)
  - Ordenação (preço, relevância, mais vendidos)
  - Paginação
  - Breadcrumb de navegação

- [ ] **Página de detalhes do produto**
  - Galeria de imagens (zoom, lightbox)
  - Descrição completa
  - Especificações técnicas
  - Preço com desconto (se houver)
  - Parcelamento (até 12x)
  - Botão "Adicionar ao Carrinho"
  - Calculadora de frete
  - Produtos relacionados
  - Avaliações (futuro)

#### 1.2.2 Carrinho de Compras
- [ ] **Funcionalidade completa do carrinho**
  - Adicionar/remover produtos
  - Alterar quantidade
  - Ver subtotal atualizado
  - Calcular frete por CEP
  - Aplicar cupom de desconto
  - Salvar carrinho (localStorage ou DB)
  - Drawer lateral (estilo Mercado Livre)

#### 1.2.3 Checkout
- [ ] **Fluxo completo de checkout**
  - Step 1: Dados pessoais e endereço de entrega
  - Step 2: Escolha de método de entrega (PAC, SEDEX, etc)
  - Step 3: Forma de pagamento (cartão de crédito)
  - Step 4: Revisão do pedido
  - Parcelamento em até 12x sem juros
  - Integração com Cielo para pagamento
  - Aplicação de cupom de desconto

#### 1.2.4 Minha Conta (Cliente)
- [ ] **Área do cliente**
  - Histórico de pedidos
  - Detalhes do pedido (produtos, valores, status)
  - Rastreamento de entrega (código dos Correios)
  - Editar dados cadastrais
  - Gerenciar endereços salvos
  - Alterar senha

#### 1.2.5 Rastreamento de Link de Revendedor
- [ ] **Sistema de tracking**
  - Capturar parâmetro do link: `/r/PAULO_ABCD1234`
  - Armazenar revendedor_id em cookie (30 dias)
  - Registrar visita no banco (Analytics)
  - Vincular pedido ao revendedor no checkout
  - Se já tem cookie de outro revendedor, substituir pelo mais recente

**PRIORIDADE:** 🔴 ALTA (essencial para funcionamento do e-commerce)

---

## 2. SISTEMA DE REVENDEDORES

### 2.1 ✅ O QUE JÁ TEM

**Cadastro:**
- [x] Formulário de cadastro (nome, email, CPF, senha)
- [x] Página de login
- [x] Dashboard básico com métricas visuais

**Dashboard:**
- [x] Saudação personalizada ("Olá, Paulo!")
- [x] Badge de nível (Bronze)
- [x] Exibição do link único
- [x] 4 cards de métricas (visual)
- [x] Relatório rápido (visual)
- [x] Botões para navegação

### 2.2 ❌ O QUE FALTA DESENVOLVER

#### 2.2.1 Cadastro e Aprovação
- [ ] **Formulário completo de cadastro**
  - Adicionar campo: Telefone
  - Adicionar seção: Dados bancários
    - Banco (select)
    - Agência
    - Conta
    - Tipo de conta (Corrente/Poupança)
  - Adicionar: Checkbox de aceite de termos
  - Validação de CPF único
  - Validação de email único
  
- [ ] **Fluxo de aprovação pendente**
  - Status inicial: "pendente"
  - Email de confirmação de cadastro
  - Notificação para admin (novo cadastro)
  - Aguardar aprovação manual
  
- [ ] **Página de "Cadastro Pendente"**
  - Após cadastro, redirecionar para página informando:
    "Seu cadastro foi enviado e será analisado em até 48 horas"
  - Status visível para o revendedor

#### 2.2.2 Sistema de Assinatura (CRÍTICO)
- [ ] **Integração com Cielo Recorrência**
  - Criar recorrência de R$ 9,90/mês
  - Tela de cadastro de cartão após aprovação
  - Processar primeiro pagamento
  - Configurar renovação automática
  - Webhook para notificações de pagamento
  
- [ ] **Página de assinatura**
  - Após aprovação, redirecionar para criar assinatura
  - Formulário de dados do cartão
  - Confirmação de pagamento
  - Se negado, permitir tentar novamente
  
- [ ] **Gestão de assinatura**
  - Ver status da assinatura (ativo/suspenso/cancelado)
  - Ver data da próxima cobrança
  - Histórico de pagamentos
  - Botão para cancelar assinatura
  - Atualizar dados do cartão
  
- [ ] **Fluxo de inadimplência**
  - Se pagamento falhar → status "suspenso" por 7 dias
  - Email de notificação
  - Após 7 dias sem pagar → status "cancelado"
  - Bloquear acesso ao dashboard se suspenso

**PRIORIDADE:** 🔴 CRÍTICA (sem isso, não há receita recorrente)

#### 2.2.3 Dashboard - Funcionalidades Reais
- [ ] **Tornar métricas funcionais**
  - Total Vendido: calcular do banco de dados
  - Comissão: calcular baseado nas regras
  - Visitas: contar clicks no link
  - Conversão: calcular (vendas / visitas) * 100
  
- [ ] **Gráficos e tendências**
  - Implementar gráficos (Chart.js ou Recharts)
  - Line chart: Vendas ao longo do tempo
  - Bar chart: Vendas por categoria
  - Donut chart: Comissões (pendente/disponível/sacado)
  
- [ ] **Página "Ver Vendas"**
  - Tabela com histórico de vendas
  - Colunas: Data, Produto, Valor, Comissão, Status
  - Filtros por período
  - Paginação
  - Exportar para Excel/CSV
  
- [ ] **Link único funcional**
  - Botão "Copiar Link" com feedback
  - Gerar QR Code do link
  - Download de QR Code (PNG)
  - Botões de compartilhamento social (WhatsApp, Facebook)

#### 2.2.4 Materiais de Marketing
- [ ] **Página de materiais**
  - Banco de imagens dos produtos
  - Banners prontos (Stories, Feed, Facebook)
  - Catálogos em PDF
  - Grid de cards com preview
  - Botão de download individual
  - Download em lote
  
- [ ] **Upload de materiais (Admin)**
  - Admin pode fazer upload de novos materiais
  - Organizar por categoria
  - Definir título e descrição
  - Notificar revendedores sobre novidades

#### 2.2.5 Sistema de Cupons
- [ ] **Criar cupons**
  - Formulário: Código, Tipo (% ou R$), Valor, Validade, Limite de uso
  - Validação: Desconto máximo 10% ou R$ 50
  - Visualizar cupons criados
  - Ativar/desativar cupom
  - Ver quantas vezes foi usado
  - Ver valor total de desconto concedido
  
- [ ] **Validação no checkout**
  - Cliente informa código
  - Sistema valida:
    - Cupom existe e está ativo
    - Compra veio pelo link do revendedor do cupom
    - Cupom não expirou
    - Limite de uso não atingido
  - Aplicar desconto
  - Reduzir base de cálculo da comissão

#### 2.2.6 Precificação Personalizada (Opcional)
- [ ] **Habilitação por admin**
  - Admin pode habilitar para revendedores específicos
  - Flag no cadastro: `can_set_custom_price`
  
- [ ] **Definir preços customizados**
  - Página de precificação
  - Listar produtos
  - Definir preço customizado (validar > preço base)
  - Salvar e aplicar
  
- [ ] **Aplicação no checkout**
  - Se compra veio pelo link do revendedor
  - E revendedor tem precificação habilitada
  - Mostrar preço customizado
  - Comissão sempre sobre preço base

#### 2.2.7 Sistema de Saques (CRÍTICO)
- [ ] **Visualizar saldo**
  - Saldo disponível (comissões liberadas)
  - Saldo pendente (ainda em carência)
  - Saldo total
  - Histórico de comissões detalhado
  
- [ ] **Solicitar saque**
  - Botão "Solicitar Saque"
  - Validar saldo mínimo (R$ 50,00)
  - Confirmar dados bancários
  - Criar solicitação (status: solicitado)
  - Email de confirmação
  - Bloquear novo saque até aprovação/rejeição
  
- [ ] **Acompanhar saques**
  - Tabela de saques solicitados
  - Status: Solicitado, Aprovado, Pago, Rejeitado
  - Data de solicitação
  - Data de aprovação/pagamento
  - Valor
  - Motivo da rejeição (se houver)

**PRIORIDADE:** 🔴 CRÍTICA (sem isso, revendedor não recebe)

---

## 3. PAINEL ADMINISTRATIVO (COMPLETAMENTE FALTANDO)

### 3.1 ❌ O QUE FALTA DESENVOLVER

#### 3.1.1 Autenticação Admin
- [ ] **Login de administrador**
  - Tela de login separada (`/admin/login`)
  - Autenticação com role "admin"
  - Diferentes permissões (admin, super_admin)

#### 3.1.2 Dashboard Geral
- [ ] **Visão geral do negócio**
  - Cards de métricas principais:
    - Total de vendas (dia, semana, mês, ano)
    - Total de pedidos
    - Ticket médio
    - Taxa de conversão global
    - Revendedores ativos
    - Receita de assinaturas
  
- [ ] **Gráficos**
  - Vendas ao longo do tempo
  - Vendas diretas vs por revendedores
  - Top 10 revendedores
  - Top 10 produtos mais vendidos
  - Distribuição por região

#### 3.1.3 Gestão de Revendedores
- [ ] **Lista de cadastros pendentes**
  - Tabela com cadastros aguardando aprovação
  - Colunas: Nome, CPF, Email, Data do cadastro
  - Botão "Analisar" para cada
  
- [ ] **Aprovar/Rejeitar cadastro**
  - Modal com detalhes completos do revendedor
  - Botão "Aprovar"
    - Muda status para "aprovado"
    - Envia email de boas-vindas
    - Revendedor pode criar assinatura
  - Botão "Rejeitar"
    - Campo obrigatório: Motivo da rejeição
    - Envia email com motivo
    - Status "rejeitado"
  
- [ ] **Lista de revendedores ativos**
  - Tabela com todos os revendedores
  - Filtros: Status (ativo, suspenso, cancelado), Nível (bronze, prata, ouro)
  - Busca por nome, email, CPF
  - Colunas: Nome, Nível, Total Vendido, Comissão Paga, Status, Assinatura
  - Ações: Ver detalhes, Suspender, Habilitar precificação
  
- [ ] **Detalhes do revendedor**
  - Dados cadastrais completos
  - Dados bancários
  - Histórico de vendas
  - Histórico de comissões
  - Histórico de saques
  - Status da assinatura
  - Link único
  - Botões:
    - Suspender/Reativar
    - Habilitar/Desabilitar precificação personalizada
    - Resetar senha
    - Ver como revendedor (impersonation)

#### 3.1.4 Gestão de Saques (CRÍTICO)
- [ ] **Lista de solicitações pendentes**
  - Tabela de saques aguardando aprovação
  - Colunas: Revendedor, Valor, Data da solicitação, Dados bancários
  - Badge de "Novo" para não visualizados
  - Notificação sonora/visual para novos saques
  
- [ ] **Aprovar saque**
  - Visualizar detalhes:
    - Nome do revendedor
    - CPF
    - Valor solicitado
    - Comissões que compõem o valor
    - Dados bancários completos
  - Botão "Aprovar"
    - Cria "conta a pagar" no Bling (integração)
    - Status muda para "aprovado"
    - Email para revendedor
  - Após transferência bancária manual:
    - Botão "Marcar como Pago"
    - Status muda para "pago"
    - Comissões mudam para status "sacado"
    - Email de confirmação
  
- [ ] **Rejeitar saque**
  - Campo obrigatório: Motivo da rejeição
  - Status muda para "rejeitado"
  - Email para revendedor
  - Saldo volta para disponível
  
- [ ] **Histórico de saques**
  - Filtros por status, período, revendedor
  - Exportar relatório

**PRIORIDADE:** 🔴 CRÍTICA (fluxo de pagamento para revendedores)

#### 3.1.5 Gestão de Produtos
- [ ] **Sincronização com Bling**
  - Botão "Sincronizar Produtos"
  - Executa sincronização manual
  - Mostra progresso
  - Log de sincronização (X atualizados, Y criados, Z erros)
  - Cron job automático (1x por hora)
  
- [ ] **Lista de produtos**
  - Tabela com todos os produtos
  - Filtros: Categoria, Status (ativo/inativo), Estoque (disponível/esgotado)
  - Busca por nome, SKU
  - Colunas: Imagem, Nome, SKU, Preço, Estoque, Status
  - Ações: Editar, Ativar/Desativar
  
- [ ] **Editar produto**
  - Campos editáveis:
    - Nome
    - Descrição
    - Preço (sobrescreve do Bling temporariamente)
    - Status (ativo/inativo)
    - Categoria
  - Não editar: SKU, Código Bling (vem do Bling)
  
- [ ] **Gerenciar categorias**
  - CRUD de categorias
  - Hierarquia (categoria pai)
  - Slug para URL
  
- [ ] **Gerenciar imagens**
  - Ver imagens do produto
  - Reordenar imagens
  - Definir imagem principal
  - Upload manual de imagens (complementar Magis5)

#### 3.1.6 Gestão de Pedidos
- [ ] **Lista de pedidos**
  - Tabela com todos os pedidos
  - Filtros: Status, Período, Revendedor
  - Busca por número do pedido, cliente
  - Colunas: #Pedido, Cliente, Valor, Status, Revendedor, Data
  - Badge de cor por status
  
- [ ] **Detalhes do pedido**
  - Informações completas:
    - Dados do cliente
    - Produtos comprados
    - Valores (subtotal, frete, desconto, total)
    - Endereço de entrega
    - Método de pagamento
    - Status do pagamento
    - Código de rastreamento
    - Revendedor associado (se houver)
  - Histórico de status
  - Botões:
    - Atualizar status manualmente
    - Adicionar código de rastreamento
    - Cancelar pedido
    - Estornar pagamento
    - Ver pedido no Bling

#### 3.1.7 Gestão de Comissões
- [ ] **Configurar regras de comissão**
  - Tabela de faixas:
    - Vendas de R$ X a R$ Y = Z%
  - Adicionar/remover faixas
  - Editar percentuais
  - Definir período de carência (dias)
  - Salvar e aplicar
  
- [ ] **Liberar comissões manualmente**
  - Ver comissões pendentes próximas de liberar
  - Liberar antecipadamente (caso especial)
  - Reverter comissão (pedido fraudulento)
  
- [ ] **Relatório de comissões**
  - Total pago em comissões (mês, ano)
  - Total pendente
  - Total disponível
  - Projeção de comissões futuras
  - Gráfico de evolução
  - Exportar relatório

#### 3.1.8 Gestão de Níveis
- [ ] **Configurar níveis**
  - Editar faixas de vendas:
    - Bronze: R$ 0 a R$ X
    - Prata: R$ X+1 a R$ Y
    - Ouro: Acima de R$ Y
  - Definir benefícios de cada nível
  - Salvar configurações
  
- [ ] **Recálculo automático**
  - Cron job mensal (dia 1º)
  - Recalcula vendas dos últimos 12 meses
  - Atualiza nível de cada revendedor
  - Envia email se mudou de nível

#### 3.1.9 Relatórios e Análises
- [ ] **Relatórios disponíveis**
  - Vendas por período
  - Vendas por produto
  - Vendas por categoria
  - Vendas por revendedor
  - Comissões pagas
  - Comissões pendentes
  - ROI do programa de afiliados
  - Performance de revendedores (ranking)
  - Origem de vendas (direta vs revendedor)
  
- [ ] **Exportação**
  - Formatos: Excel, CSV, PDF
  - Agendamento de relatórios (semanal, mensal)
  - Envio por email

#### 3.1.10 Configurações do Sistema
- [ ] **Configurações gerais**
  - Valor da assinatura mensal
  - Valor mínimo de saque
  - Dias de carência para comissão
  - Percentuais de comissão (faixas)
  - Desconto máximo de cupons
  - Cookies de rastreamento (dias de validade)
  
- [ ] **Configurações de email**
  - Templates de emails
  - SMTP settings
  - Emails de notificação (ativar/desativar)
  
- [ ] **Configurações de integrações**
  - Credenciais Bling
  - Credenciais Magis5
  - Credenciais Cielo
  - Credenciais Melhor Envio
  - Testar conexões

**PRIORIDADE:** 🔴 CRÍTICA (sem painel admin, não há controle)

---

## 4. INTEGRAÇÕES EXTERNAS (COMPLETAMENTE FALTANDO)

### 4.1 ❌ O QUE FALTA DESENVOLVER

#### 4.1.1 Integração Bling (CRÍTICA)
- [ ] **Autenticação OAuth 2.0**
  - Implementar fluxo OAuth
  - Armazenar tokens (access_token, refresh_token)
  - Renovar token automaticamente
  
- [ ] **Sincronização de produtos**
  - GET /produtos (listar produtos do Bling)
  - Para cada produto:
    - Buscar no banco por bling_id
    - Se existe: atualizar (preço, estoque, nome, descrição)
    - Se não existe: criar novo
  - Salvar log de sincronização
  - Cron job: executar 1x por hora
  
- [ ] **Webhook de estoque**
  - Configurar webhook no Bling
  - Endpoint: POST /api/webhooks/bling/stock-update
  - Atualizar estoque em tempo real
  
- [ ] **Enviar pedidos**
  - Quando pedido for pago no site
  - POST /pedido (criar pedido no Bling)
  - Enviar:
    - Dados do cliente
    - Produtos comprados
    - Endereço de entrega
    - Valor total
  - Armazenar bling_order_id no pedido
  
- [ ] **Criar contas a pagar**
  - Quando saque for aprovado
  - POST /contapagar (criar conta a pagar no Bling)
  - Dados:
    - Fornecedor = Revendedor
    - Valor = Valor do saque
    - Vencimento = +5 dias
    - Descrição = Comissão de vendas
  - Armazenar bling_payable_id

**PRIORIDADE:** 🔴 CRÍTICA (coração do sistema)

#### 4.1.2 Integração Magis5
- [ ] **Sincronização de imagens**
  - GET /products/{sku}/images (buscar por SKU)
  - Receber URLs das imagens
  - Baixar e armazenar localmente (ou usar URLs diretas)
  - Associar ao produto
  - Cron job: executar 1x por dia
  
- [ ] **Fallback**
  - Se Magis5 não retornar imagens
  - Usar imagem placeholder
  - Ou permitir upload manual pelo admin

**PRIORIDADE:** 🟡 MÉDIA (importante para visual)

#### 4.1.3 Integração Cielo (CRÍTICA)
- [ ] **Cielo Checkout (Produtos)**
  - Implementar fluxo de pagamento
  - Criar transação de cartão de crédito
  - Parcelamento até 12x sem juros
  - Captura automática
  - Retorno do pagamento (sucesso/falha)
  
- [ ] **Cielo Recorrência (Assinatura)**
  - Criar recorrência de R$ 9,90/mês
  - Primeira cobrança imediata
  - Renovação automática
  - Gerenciar recorrência (cancelar, atualizar cartão)
  
- [ ] **Webhooks Cielo**
  - Configurar notificações de:
    - Pagamento autorizado
    - Pagamento capturado
    - Pagamento cancelado
    - Recorrência criada
    - Recorrência cancelada
    - Pagamento recorrente confirmado
    - Pagamento recorrente falhou
  - Endpoint: POST /api/webhooks/cielo
  - Validar assinatura do webhook
  - Processar notificação
  - Atualizar status no banco

**PRIORIDADE:** 🔴 CRÍTICA (sem pagamento, sem vendas)

#### 4.1.4 Integração Melhor Envio
- [ ] **Cálculo de frete**
  - POST /shipment/calculate
  - Enviar:
    - CEP origem (Kaza Tem)
    - CEP destino (cliente)
    - Peso e dimensões dos produtos
  - Receber opções (PAC, SEDEX, etc)
  - Exibir no checkout
  - Cliente escolhe opção
  
- [ ] **Alternativa: Bling + Melhor Envio**
  - Verificar se Bling já tem integração com Melhor Envio
  - Se sim, usar via Bling
  - Se não, integrar diretamente

**PRIORIDADE:** 🟡 MÉDIA (pode usar frete fixo no MVP)

---

## 5. SISTEMA DE RASTREAMENTO E ANALYTICS (FALTANDO)

### 5.1 ❌ O QUE FALTA DESENVOLVER

#### 5.1.1 Rastreamento de Visitas
- [ ] **Registrar visitas**
  - Quando cliente clica em link: `/r/PAULO_ABCD1234`
  - Salvar no banco (tabela `visits`):
    - reseller_id
    - ip_address
    - user_agent
    - referrer
    - timestamp
  - Atualizar contador de visitas do revendedor

#### 5.1.2 Cookie de Rastreamento
- [ ] **Armazenar revendedor**
  - Criar cookie: `reseller_id`
  - Validade: 30 dias
  - Se já existe cookie de outro revendedor, sobrescrever
  
#### 5.1.3 Vincular Pedido ao Revendedor
- [ ] **No checkout**
  - Ler cookie `reseller_id`
  - Se existe, vincular pedido ao revendedor
  - Salvar `reseller_id` no pedido
  
#### 5.1.4 Calcular Conversão
- [ ] **Taxa de conversão**
  - Total de visitas (do cookie)
  - Total de pedidos vinculados
  - Conversão = (pedidos / visitas) * 100
  - Exibir no dashboard

**PRIORIDADE:** 🔴 ALTA (essencial para rastreamento)

---

## 6. SISTEMA DE COMISSIONAMENTO (FALTANDO)

### 6.1 ❌ O QUE FALTA DESENVOLVER

#### 6.1.1 Cálculo Automático de Comissão
- [ ] **Quando pedido é pago**
  - Calcular base: Total do pedido - Frete - Desconto de cupom
  - Buscar vendas do revendedor no mês atual
  - Identificar faixa de comissão (10%, 15%, 20%, 30%)
  - Calcular comissão = Base × Percentual
  - Criar registro na tabela `commissions`:
    - reseller_id
    - order_id
    - amount (valor da comissão)
    - status: "pending"
    - available_at: NOW() + 30 dias
  
#### 6.1.2 Liberar Comissões
- [ ] **Cron job diário**
  - Buscar comissões com status "pending"
  - Onde available_at <= NOW()
  - Mudar status para "available"
  - Atualizar saldo disponível do revendedor
  
#### 6.1.3 Reverter Comissão
- [ ] **Quando pedido é cancelado**
  - Buscar comissão do pedido
  - Se status "pending": deletar
  - Se status "available": subtrair do saldo
  - Se status "withdrawn": marcar como "debt" (débito futuro)
  
#### 6.1.4 Marcar como Sacado
- [ ] **Quando saque é pago**
  - Buscar comissões que compõem o saque
  - Mudar status para "withdrawn"
  - Subtrair do saldo disponível

**PRIORIDADE:** 🔴 CRÍTICA (coração do programa de afiliados)

---

## 7. EMAILS TRANSACIONAIS (FALTANDO)

### 7.1 ❌ O QUE FALTA DESENVOLVER

- [ ] **Email de confirmação de cadastro (Revendedor)**
- [ ] **Email de aprovação de cadastro**
- [ ] **Email de rejeição de cadastro**
- [ ] **Email de boas-vindas (após criar assinatura)**
- [ ] **Email de pagamento de assinatura confirmado**
- [ ] **Email de falha no pagamento de assinatura**
- [ ] **Email de suspensão por inadimplência**
- [ ] **Email de cancelamento de assinatura**
- [ ] **Email de nova venda (para revendedor)**
- [ ] **Email de comissão disponível**
- [ ] **Email de solicitação de saque recebida**
- [ ] **Email de saque aprovado**
- [ ] **Email de saque pago**
- [ ] **Email de saque rejeitado**
- [ ] **Email de confirmação de pedido (Cliente)**
- [ ] **Email de envio de pedido (Cliente)**
- [ ] **Email de pedido entregue (Cliente)**

**PRIORIDADE:** 🟡 MÉDIA (importante para comunicação)

---

## 8. LOGS E AUDITORIA (FALTANDO)

### 8.1 ❌ O QUE FALTA DESENVOLVER

- [ ] **Log de sincronizações**
  - Registrar cada sincronização do Bling/Magis5
  - Produtos atualizados/criados/erros
  - Horário, duração, status
  
- [ ] **Log de webhooks**
  - Registrar cada webhook recebido
  - Payload completo
  - Status de processamento
  
- [ ] **Log de ações do admin**
  - Aprovar/rejeitar cadastro
  - Aprovar/rejeitar saque
  - Editar produto
  - Suspender revendedor
  
- [ ] **Log de erros**
  - Erros de integração
  - Erros de pagamento
  - Erros do sistema

**PRIORIDADE:** 🟢 BAIXA (útil para debug)

---

## 9. SEGURANÇA E VALIDAÇÕES (FALTANDO)

### 9.1 ❌ O QUE FALTA DESENVOLVER

- [ ] **Rate limiting**
  - Limitar requisições por IP
  - Proteção contra ataques DDoS
  
- [ ] **Validação de CPF**
  - Algoritmo de validação
  - Consulta em API externa (opcional)
  - Anti-fraude básico
  
- [ ] **Proteção contra fraude**
  - Detectar revendedor comprando pelo próprio link
  - Detectar padrões suspeitos de vendas
  - Alertar admin
  
- [ ] **LGPD**
  - Consentimento explícito
  - Política de privacidade
  - Termos de uso
  - Direito ao esquecimento (deletar conta)

**PRIORIDADE:** 🟡 MÉDIA (importante para segurança)

---

## 10. TESTES (FALTANDO)

### 10.1 ❌ O QUE FALTA DESENVOLVER

- [ ] **Testes unitários**
  - Domain entities
  - Value objects
  - Use cases
  
- [ ] **Testes de integração**
  - Repositories
  - Integrações externas (mock)
  
- [ ] **Testes E2E**
  - Fluxo completo de compra
  - Fluxo de cadastro de revendedor
  - Fluxo de saque

**PRIORIDADE:** 🟢 BAIXA (importante mas pode ser feito depois do MVP)

---

## 11. MELHORIAS DE UX/UI (FALTANDO)

### 11.1 ❌ O QUE FALTA DESENVOLVER

- [ ] **Loading states**
  - Skeleton loading em todas as telas
  - Spinners durante ações
  
- [ ] **Empty states**
  - Carrinho vazio
  - Sem produtos encontrados
  - Sem vendas ainda
  - Sem comissões
  
- [ ] **Confirmações**
  - Modal de confirmação antes de ações críticas
  - "Tem certeza que deseja cancelar?"
  
- [ ] **Feedbacks visuais**
  - Toast notifications (sucesso/erro)
  - Animações suaves
  - Transições entre páginas
  
- [ ] **Responsividade**
  - Testar em mobile
  - Ajustar layouts
  - Menu hambúrguer funcional

**PRIORIDADE:** 🟢 MÉDIA (melhora experiência)

---

## 📊 RESUMO POR PRIORIDADE

### 🔴 CRÍTICO (Bloqueia MVP)

1. **Sistema de Assinatura (Cielo Recorrência)**
2. **Sistema de Aprovação de Cadastros**
3. **Sistema de Rastreamento de Vendas por Link**
4. **Sistema de Cálculo de Comissões**
5. **Sistema de Saques**
6. **Painel Administrativo Completo**
7. **Integração Bling (Produtos e Pedidos)**
8. **Integração Cielo (Pagamento e Recorrência)**
9. **Checkout Funcional**
10. **Carrinho de Compras**

### 🟡 ALTO (Importante mas não bloqueia)

11. **Página de Listagem de Produtos**
12. **Página de Detalhes do Produto**
13. **Materiais de Marketing**
14. **Sistema de Cupons**
15. **Integração Magis5 (Imagens)**
16. **Emails Transacionais**

### 🟢 MÉDIO (Pode ser feito depois)

17. **Precificação Personalizada**
18. **Sistema de Níveis**
19. **Relatórios Avançados**
20. **Integração Melhor Envio**
21. **Logs e Auditoria**
22. **Melhorias de UX/UI**

### ⚪ BAIXO (Futuro)

23. **Testes Automatizados**
24. **Chat interno**
25. **App Mobile**
26. **Gamificação**

---

## 📈 ESTIMATIVA DE ESFORÇO

### Por Prioridade:

| Prioridade | Itens | Estimativa (Semanas) | % Conclusão Atual |
|-----------|-------|---------------------|-------------------|
| 🔴 CRÍTICO | 10 itens | 12-14 semanas | 5% |
| 🟡 ALTO | 6 itens | 4-5 semanas | 10% |
| 🟢 MÉDIO | 6 itens | 3-4 semanas | 0% |
| ⚪ BAIXO | 4 itens | 2-3 semanas | 0% |
| **TOTAL** | **26 grupos** | **21-26 semanas** | **~10%** |

### Situação Atual:
- **Desenvolvido:** ~10% do projeto total
- **Faltando para MVP:** ~90%
- **Estimativa para MVP:** 16-19 semanas (4-5 meses)

---

## 🎯 ROADMAP RECOMENDADO

### SPRINT 1-2 (2 semanas) - Painel Admin Básico
- Autenticação admin
- Dashboard básico
- Gestão de cadastros (aprovar/rejeitar)
- Listagem de revendedores

### SPRINT 3-4 (2 semanas) - Sistema de Assinatura
- Integração Cielo Recorrência
- Fluxo completo de assinatura
- Webhooks de pagamento
- Gestão de inadimplência

### SPRINT 5-6 (2 semanas) - E-commerce Básico
- Carrinho funcional
- Checkout com Cielo
- Gestão de pedidos (admin)

### SPRINT 7-8 (2 semanas) - Integração Bling
- OAuth 2.0
- Sincronização de produtos
- Envio de pedidos
- Cron job de sincronização

### SPRINT 9-10 (2 semanas) - Rastreamento
- Sistema de tracking de links
- Analytics de visitas
- Vincular pedidos a revendedores

### SPRINT 11-12 (2 semanas) - Comissões
- Cálculo automático
- Regras configuráveis
- Liberar comissões (cron)
- Visualização no dashboard

### SPRINT 13-14 (2 semanas) - Saques
- Solicitar saque
- Aprovação admin
- Integração Bling (contas a pagar)
- Histórico de saques

### SPRINT 15-16 (2 semanas) - Finalização MVP
- Listagem de produtos
- Detalhes de produto
- Integração Magis5 (imagens)
- Materiais de marketing
- Emails transacionais
- Testes e correções

---

## ✅ CHECKLIST DE VALIDAÇÃO DO MVP

### Funcionalidades Essenciais:

**E-commerce:**
- [ ] Cliente consegue ver produtos
- [ ] Cliente consegue adicionar ao carrinho
- [ ] Cliente consegue fazer checkout
- [ ] Cliente consegue pagar com cartão (Cielo)
- [ ] Pedido é criado no Bling automaticamente

**Revendedor:**
- [ ] Pessoa consegue se cadastrar
- [ ] Admin aprova cadastro
- [ ] Revendedor cria assinatura (R$ 9,90/mês)
- [ ] Revendedor recebe link único funcional
- [ ] Vendas pelo link são rastreadas
- [ ] Comissões são calculadas automaticamente
- [ ] Comissões ficam disponíveis após 30 dias
- [ ] Revendedor solicita saque
- [ ] Admin aprova saque
- [ ] Saque cria conta a pagar no Bling

**Admin:**
- [ ] Admin vê cadastros pendentes e pode aprovar/rejeitar
- [ ] Admin vê solicitações de saque e pode aprovar/rejeitar
- [ ] Admin vê dashboard com métricas principais
- [ ] Admin consegue sincronizar produtos do Bling
- [ ] Admin vê lista de pedidos

---

## 📞 PRÓXIMOS PASSOS RECOMENDADOS

1. **VALIDAR ESTE DOCUMENTO** com stakeholders
2. **PRIORIZAR** o que é realmente MVP vs o que pode esperar
3. **DEFINIR EQUIPE** (quantos desenvolvedores, designers, etc)
4. **ESTIMAR NOVAMENTE** baseado na equipe real
5. **COMEÇAR PELAS INTEGRAÇÕES CRÍTICAS:**
   - Cielo (pagamento + recorrência)
   - Bling (produtos + pedidos)
6. **DESENVOLVER EM SPRINTS** de 2 semanas
7. **TESTAR CONSTANTEMENTE** cada funcionalidade

---

**CONCLUSÃO:**

O sistema está em **~10% de conclusão**. A parte desenvolvida é majoritariamente **visual/frontend estático**.

**Falta desenvolver:**
- ✅ 90% do backend (lógica de negócio, integrações, cálculos)
- ✅ 100% do painel administrativo
- ✅ 80% do portal do revendedor (funcionalidades reais)
- ✅ 60% do e-commerce (checkout, carrinho, rastreamento)

**Estimativa realista para MVP:** 16-19 semanas (4-5 meses) com equipe dedicada.

**FIM DO DOCUMENTO DE GAP ANALYSIS**
