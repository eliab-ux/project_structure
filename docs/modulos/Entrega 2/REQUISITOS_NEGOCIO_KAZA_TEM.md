# REQUISITOS DE NEGÓCIO - KAZA TEM IMPORTS

**Projeto:** E-commerce com Sistema de Revendedores  
**Cliente:** Kaza Tem Imports  
**Data:** Janeiro 2025  
**Versão:** 1.0

---

## 📋 ÍNDICE

1. [Visão Geral do Negócio](#1-visão-geral-do-negócio)
2. [Objetivos do Sistema](#2-objetivos-do-sistema)
3. [Personas e Usuários](#3-personas-e-usuários)
4. [Funcionalidades Principais](#4-funcionalidades-principais)
5. [Regras de Negócio](#5-regras-de-negócio)
6. [Fluxos de Usuário](#6-fluxos-de-usuário)
7. [Integrações Externas](#7-integrações-externas)
8. [Sistema de Comissionamento](#8-sistema-de-comissionamento)
9. [Sistema de Níveis de Revendedor](#9-sistema-de-níveis-de-revendedor)
10. [Assinatura Mensal](#10-assinatura-mensal)
11. [Sistema de Saques](#11-sistema-de-saques)
12. [Materiais de Marketing](#12-materiais-de-marketing)
13. [Sistema de Cupons](#13-sistema-de-cupons)
14. [Precificação Personalizada](#14-precificação-personalizada)
15. [Relatórios e Métricas](#15-relatórios-e-métricas)
16. [Requisitos Não-Funcionais](#16-requisitos-não-funcionais)

---

## 1. VISÃO GERAL DO NEGÓCIO

### 1.1 Contexto

A **Kaza Tem Imports** é uma empresa que comercializa produtos de decoração, cama, mesa, banho e utilidades domésticas. A empresa deseja expandir suas vendas através de um modelo de negócio híbrido:

1. **E-commerce B2C:** Venda direta ao consumidor final através de loja virtual própria
2. **Programa de Revendedores:** Pessoas físicas que revendem os produtos através de links personalizados e recebem comissões

### 1.2 Problema a Resolver

Atualmente a empresa:
- Não possui presença digital estruturada
- Depende de vendas presenciais ou por WhatsApp
- Não tem controle sobre revendedores e suas comissões
- Não consegue escalar vendas de forma organizada
- Não tem visibilidade sobre origem das vendas

### 1.3 Proposta de Valor

O sistema proporcionará:
- **Para a Empresa:** Canal de vendas escalável, controle de estoque, rastreabilidade de vendas
- **Para Revendedores:** Renda extra através de comissões, autonomia de vendas, suporte e materiais
- **Para Clientes Finais:** Loja virtual profissional, variedade de produtos, pagamento seguro

---

## 2. OBJETIVOS DO SISTEMA

### 2.1 Objetivos de Negócio

1. **Aumentar Vendas:** Escalar faturamento através de múltiplos canais (direto + revendedores)
2. **Criar Rede de Revendedores:** Formar e gerenciar rede de afiliados motivados
3. **Automatizar Operações:** Reduzir trabalho manual em gestão de pedidos, comissões e estoque
4. **Profissionalizar Marca:** Ter presença digital profissional e confiável
5. **Gerar Receita Recorrente:** Mensalidade dos revendedores ativos

### 2.2 Objetivos dos Usuários

**Cliente Final:**
- Comprar produtos de forma fácil e segura
- Receber em casa com frete calculado
- Ter suporte em caso de dúvidas

**Revendedor:**
- Gerar renda extra sem investimento inicial
- Ter acesso a produtos de qualidade para revenda
- Acompanhar vendas e comissões em tempo real
- Receber pagamentos de forma transparente

**Administrador (Kaza Tem):**
- Controlar cadastro de revendedores
- Aprovar saques manualmente
- Monitorar vendas e performance
- Gerenciar produtos e estoque

---

## 3. PERSONAS E USUÁRIOS

### 3.1 Cliente Final

**Perfil:**
- Nome: Ana Carolina
- Idade: 28-45 anos
- Ocupação: Profissional liberal, dona de casa, funcionária CLT
- Comportamento: Busca decorar casa, compra online, valoriza qualidade e preço justo
- Necessidades: Produtos bonitos, entrega confiável, pagamento parcelado

### 3.2 Revendedor

**Perfil:**
- Nome: Paulo Ricardo
- Idade: 25-50 anos
- Ocupação: Autônomo, estudante, trabalhador que busca renda extra
- Comportamento: Ativo em redes sociais, tem network de amigos/família
- Motivação: Ganhar comissão (10-30%), trabalhar em horários flexíveis
- Necessidades: Link fácil de compartilhar, materiais prontos, pagamento garantido

### 3.3 Administrador

**Perfil:**
- Nome: Equipe Kaza Tem
- Função: Gestão operacional da empresa
- Responsabilidades: Aprovar cadastros, liberar saques, controlar estoque, analisar vendas
- Necessidades: Dashboard de controle, relatórios, ferramentas de aprovação

---

## 4. FUNCIONALIDADES PRINCIPAIS

### 4.1 E-commerce (Cliente Final)

#### 4.1.1 Catálogo de Produtos
- Visualizar lista de produtos com filtros (categoria, preço, cor, etc)
- Buscar produtos por nome ou SKU
- Ver detalhes do produto (fotos, descrição, especificações, preço, estoque)
- Visualizar produtos relacionados
- Adicionar produtos aos favoritos

#### 4.1.2 Carrinho de Compras
- Adicionar/remover produtos
- Alterar quantidade
- Ver subtotal atualizado em tempo real
- Aplicar cupom de desconto
- Calcular frete informando CEP

#### 4.1.3 Checkout
- Informar dados pessoais e endereço de entrega
- Escolher método de entrega (PAC, SEDEX, etc)
- Escolher forma de pagamento (cartão de crédito via Cielo)
- Parcelar compras em até 12x sem juros
- Receber confirmação do pedido por email

#### 4.1.4 Minha Conta
- Visualizar histórico de pedidos
- Acompanhar status de entrega (código de rastreamento)
- Editar dados cadastrais
- Gerenciar endereços salvos

### 4.2 Portal do Revendedor

#### 4.2.1 Cadastro e Aprovação
- Preencher formulário de cadastro (dados pessoais, CPF, dados bancários)
- Aguardar aprovação manual pela equipe Kaza Tem
- Receber email de aprovação/rejeição
- Após aprovação, ser direcionado para criar assinatura mensal

#### 4.2.2 Assinatura
- Assinar plano mensal de R$ 9,90 via cartão de crédito (Cielo Recorrência)
- Renovação automática todo mês
- Possibilidade de cancelar a qualquer momento
- Em caso de inadimplência, status do revendedor muda para "suspenso"

#### 4.2.3 Link de Afiliado
- Receber link único personalizado: `kazatem.shop/r/NOME_CODIGO`
- Compartilhar link em redes sociais, WhatsApp, etc
- Ver QR Code do link para facilitar compartilhamento
- Download de QR Code em diferentes tamanhos

#### 4.2.4 Dashboard
- Ver métricas principais:
  - Total vendido no mês
  - Comissão acumulada (pendente e disponível)
  - Número de visitas ao link
  - Taxa de conversão
- Visualizar gráficos de vendas ao longo do tempo
- Ver histórico de vendas detalhado
- Ver histórico de comissões

#### 4.2.5 Materiais de Marketing
- Acessar banco de imagens dos produtos
- Baixar banners, posts para redes sociais
- Baixar catálogos em PDF
- Ver sugestões de copy para posts

#### 4.2.6 Cupons Personalizados
- Criar cupons de desconto personalizados
- Definir valor ou percentual de desconto (dentro dos limites)
- Definir validade do cupom
- Acompanhar quantas vezes o cupom foi usado

#### 4.2.7 Precificação Personalizada (Opcional)
- Se habilitado pelo admin, definir preços customizados para produtos
- **Regra:** Só pode aumentar preços, nunca diminuir abaixo do preço base
- Comissão sempre calculada sobre o preço base do site

#### 4.2.8 Saques
- Solicitar saque quando tiver saldo disponível
- Valor mínimo para saque: R$ 50,00 (configurável)
- Confirmar dados bancários antes de solicitar
- Acompanhar status do saque (solicitado, aprovado, pago)
- Receber confirmação por email quando pago

### 4.3 Painel Administrativo

#### 4.3.1 Gestão de Revendedores
- Ver lista de cadastros pendentes de aprovação
- Aprovar ou rejeitar cadastros (com motivo da rejeição)
- Ver lista de revendedores ativos
- Suspender ou reativar revendedores
- Habilitar/desabilitar precificação personalizada por revendedor
- Ver detalhes completos de cada revendedor

#### 4.3.2 Gestão de Saques
- Ver lista de solicitações de saque pendentes
- Aprovar saques (envia para Bling como "conta a pagar")
- Marcar saque como pago após efetuar pagamento externo
- Rejeitar saques (com justificativa)

#### 4.3.3 Gestão de Produtos
- Sincronizar produtos do Bling (manual ou automático)
- Ativar/desativar produtos
- Editar informações de produtos
- Gerenciar categorias

#### 4.3.4 Gestão de Comissões
- Configurar regras de comissão (percentuais graduais)
- Configurar período de carência (padrão 30 dias)
- Ver relatório de comissões pagas
- Ver projeções de comissões futuras

#### 4.3.5 Gestão de Níveis
- Configurar faixas de vendas para cada nível (Bronze, Prata, Ouro)
- Definir benefícios de cada nível
- Ver evolução dos revendedores por nível

#### 4.3.6 Relatórios e Análises
- Dashboard geral com métricas do negócio
- Relatório de vendas (total, por período, por revendedor)
- Relatório de comissões (pagas, pendentes, disponíveis)
- Relatório de produtos mais vendidos
- Relatório de revendedores mais performáticos
- Análise de ROI do programa de afiliados

---

## 5. REGRAS DE NEGÓCIO

### 5.1 Cadastro de Revendedores

**RN-001:** Revendedor deve ter CPF único no sistema (um CPF = um cadastro)  
**RN-002:** Revendedor deve informar dados bancários completos para receber saques  
**RN-003:** Link único deve ser gerado automaticamente baseado no nome do revendedor + código aleatório  
**RN-004:** Cadastro inicia com status "pendente" até aprovação manual  
**RN-005:** Aprovação deve ser feita por usuário administrador  
**RN-006:** Revendedor reprovado não pode se cadastrar novamente com mesmo CPF  
**RN-007:** Após aprovação, revendedor deve criar assinatura antes de ativar  

### 5.2 Assinatura Mensal

**RN-010:** Valor fixo de R$ 9,90 por mês  
**RN-011:** Cobrança recorrente automática via Cielo  
**RN-012:** Primeira cobrança no momento da adesão  
**RN-013:** Cobranças subsequentes todo dia do mês em que assinou  
**RN-014:** Se pagamento falhar, revendedor fica "suspenso" por 7 dias  
**RN-015:** Após 7 dias suspenso sem pagamento, status muda para "cancelado"  
**RN-016:** Revendedor pode cancelar assinatura a qualquer momento  
**RN-017:** Cancelamento não gera reembolso proporcional  
**RN-018:** Comissões pendentes são mantidas mesmo após cancelamento  

### 5.3 Rastreamento de Vendas

**RN-020:** Sistema identifica origem da venda através de cookie/sessão do navegador  
**RN-021:** Cookie expira em 30 dias (configurable)  
**RN-022:** Se cliente clicar em outro link de revendedor, o mais recente prevalece  
**RN-023:** Venda direta (sem link de revendedor) não gera comissão para ninguém  
**RN-024:** Mesmo que revendedor compre pelo próprio link, não gera comissão (anti-fraude)  

### 5.4 Cálculo de Comissões

**RN-030:** Base de cálculo = Valor Total do Pedido - Frete  
**RN-031:** Comissão varia conforme valor total vendido no mês (graduação)  
**RN-032:** Percentuais padrão (configuráveis):
- R$ 0 a R$ 1.000 = 10%
- R$ 1.001 a R$ 2.000 = 15%
- R$ 2.001 a R$ 5.000 = 20%
- Acima de R$ 5.000 = 30%

**RN-033:** Percentual aplicado é sempre sobre o total acumulado do mês  
**RN-034:** Dia 1º de cada mês, contador de vendas mensais zera  
**RN-035:** Comissão é calculada no momento do pagamento confirmado  
**RN-036:** Comissão inicia como "pendente" por X dias (padrão 30 dias)  
**RN-037:** Após X dias, comissão muda para "disponível" e pode ser sacada  
**RN-038:** Comissão de pedido cancelado/estornado é revertida  

### 5.5 Níveis de Revendedor

**RN-040:** Níveis baseados em vendas anuais (últimos 12 meses), não em percentual de comissão  
**RN-041:** Faixas padrão:
- Bronze: R$ 0 a R$ 50.000/ano
- Prata: R$ 50.001 a R$ 150.000/ano
- Ouro: Acima de R$ 150.000/ano

**RN-042:** Recálculo automático mensal (dia 1º)  
**RN-043:** Nível concede benefícios (materiais exclusivos, brindes), não muda percentual de comissão  
**RN-044:** Queda de nível é permitida se vendas diminuírem  

### 5.6 Saques

**RN-050:** Valor mínimo para saque: R$ 50,00 (configurável)  
**RN-051:** Revendedor pode solicitar saque apenas do saldo "disponível"  
**RN-052:** Saldo "pendente" não pode ser sacado  
**RN-053:** Solicitação inicia como "solicitado" até aprovação manual  
**RN-054:** Admin pode aprovar ou rejeitar com justificativa  
**RN-055:** Saque aprovado gera "conta a pagar" no Bling  
**RN-056:** Admin marca como "pago" após efetuar transferência bancária  
**RN-057:** Só pode haver 1 saque "solicitado" por vez por revendedor  
**RN-058:** Após aprovação, novo saque só pode ser solicitado  

### 5.7 Cupons de Desconto

**RN-060:** Revendedor pode criar cupons personalizados  
**RN-061:** Desconto máximo: 10% ou R$ 50,00 (o que for menor)  
**RN-062:** Cupom deve ter validade definida (data de expiração)  
**RN-063:** Cupom só funciona se compra vier pelo link do revendedor  
**RN-064:** Apenas 1 cupom por pedido  
**RN-065:** Desconto do cupom reduz a base de cálculo da comissão  

### 5.8 Precificação Personalizada

**RN-070:** Funcionalidade opcional, habilitada por admin por revendedor  
**RN-071:** Revendedor pode definir preços customizados para produtos  
**RN-072:** **REGRA CRÍTICA:** Preço customizado nunca pode ser menor que preço base do site  
**RN-073:** Comissão sempre calculada sobre o preço base, não sobre o preço customizado  
**RN-074:** Se revendedor aumentar preço, a diferença fica com ele  
**RN-075:** Preço customizado aparece apenas para compras vindas pelo link do revendedor  

### 5.9 Materiais de Marketing

**RN-080:** Materiais disponibilizados pela empresa em banco digital  
**RN-081:** Revendedor pode baixar livremente  
**RN-082:** Formatos: Imagens (JPG/PNG), Banners, Posts, Catálogos PDF  
**RN-083:** Admin pode adicionar/remover materiais a qualquer momento  

---

## 6. FLUXOS DE USUÁRIO

### 6.1 Fluxo: Cliente Realiza Compra via Link de Revendedor

```
1. Cliente recebe link do revendedor: kazatem.shop/r/PAULO_ABC123
2. Cliente clica no link
3. Sistema registra visita e armazena ID do revendedor em cookie
4. Cliente navega pelo site, adiciona produtos ao carrinho
5. Cliente vai para checkout
6. Cliente informa endereço de entrega
7. Sistema calcula frete via Melhor Envio
8. Cliente escolhe forma de pagamento
9. Cliente confirma pedido
10. Sistema processa pagamento via Cielo
11. Sistema cria pedido e vincula ao revendedor
12. Sistema calcula e cria comissão (status: pendente)
13. Sistema envia pedido para Bling
14. Cliente recebe email de confirmação
15. Após 30 dias, comissão muda para "disponível"
```

### 6.2 Fluxo: Pessoa se Cadastra como Revendedor

```
1. Pessoa acessa página "Seja um Revendedor"
2. Preenche formulário com:
   - Dados pessoais (nome completo, email, telefone, CPF)
   - Senha
   - Dados bancários (banco, agência, conta, tipo de conta)
3. Aceita termos de uso
4. Envia formulário
5. Sistema valida CPF único
6. Sistema cria cadastro com status "pendente"
7. Sistema gera link único
8. Sistema envia email de confirmação
9. Administrador recebe notificação de novo cadastro
10. Administrador analisa e aprova/rejeita
11. Se aprovado:
    - Status muda para "aprovado"
    - Revendedor recebe email com boas-vindas
    - Revendedor é direcionado para criar assinatura
12. Se rejeitado:
    - Sistema envia email com motivo
    - Cadastro fica com status "rejeitado"
```

### 6.3 Fluxo: Revendedor Cria Assinatura

```
1. Revendedor acessa área logada
2. Sistema detecta que não tem assinatura ativa
3. Exibe página de assinatura (R$ 9,90/mês)
4. Revendedor informa dados do cartão de crédito
5. Sistema cria recorrência via Cielo
6. Cielo processa primeiro pagamento
7. Se aprovado:
   - Status do revendedor muda para "ativo"
   - Sistema registra assinatura
   - Revendedor pode acessar dashboard
8. Se negado:
   - Exibe mensagem de erro
   - Permite tentar novamente
```

### 6.4 Fluxo: Revendedor Solicita Saque

```
1. Revendedor acessa "Meus Saques"
2. Sistema exibe saldo disponível
3. Revendedor clica em "Solicitar Saque"
4. Sistema valida saldo mínimo (R$ 50,00)
5. Revendedor confirma dados bancários
6. Revendedor confirma solicitação
7. Sistema cria solicitação de saque (status: solicitado)
8. Administrador recebe notificação
9. Administrador analisa e aprova/rejeita
10. Se aprovado:
    - Sistema cria "conta a pagar" no Bling
    - Status muda para "aprovado"
    - Revendedor recebe email
11. Administrador efetua transferência bancária manualmente
12. Administrador marca saque como "pago"
13. Comissões usadas mudam para status "sacado"
14. Revendedor recebe email de confirmação
```

### 6.5 Fluxo: Sincronização de Produtos

```
AUTOMÁTICO (Cron - 1x por hora):
1. Sistema consulta API do Bling
2. Busca produtos cadastrados
3. Para cada produto:
   - Verifica se já existe (pelo código Bling)
   - Se existe: atualiza preço, estoque, nome, descrição
   - Se não existe: cria novo produto
4. Sistema consulta API do Magis5
5. Busca imagens por SKU
6. Atualiza imagens dos produtos
7. Sistema gera log de sincronização

MANUAL (Admin):
1. Admin clica em "Sincronizar Produtos"
2. Sistema executa mesmo processo do automático
3. Exibe resultado: X produtos atualizados, Y criados
```

---

## 7. INTEGRAÇÕES EXTERNAS

### 7.1 Bling ERP

**Finalidade:** Gestão de produtos, estoque e pedidos

**O que sincronizar DO Bling para o Sistema:**
- Produtos (nome, SKU, descrição, preço, custo, estoque)
- Atualizações de estoque (webhook quando estoque muda)
- Categorias de produtos

**O que enviar DO Sistema para o Bling:**
- Pedidos confirmados (criar pedido no Bling)
- Contas a pagar (quando saque é aprovado)

**Frequência:**
- Sincronização de produtos: 1x por hora (automático)
- Webhooks de estoque: tempo real
- Envio de pedidos: tempo real (após pagamento confirmado)

### 7.2 Magis5

**Finalidade:** Fornecimento de imagens dos produtos

**Funcionamento:**
- Consulta API com SKU do produto
- Recebe URLs das imagens
- Baixa e armazena imagens no sistema

**Frequência:**
- Sincronização de imagens: 1x por dia (automático)
- Ou junto com sincronização de produtos

### 7.3 Cielo

**Finalidade:** Processamento de pagamentos

**Usos:**
1. **Cielo Checkout:** Para compras de produtos
   - Pagamento único
   - Parcelamento até 12x sem juros
   - Cartão de crédito

2. **Cielo Recorrência:** Para assinatura mensal dos revendedores
   - Cobrança recorrente de R$ 9,90
   - Renovação automática
   - Webhook de notificação de pagamentos

**Webhooks:**
- Pagamento autorizado
- Pagamento capturado
- Pagamento cancelado
- Recorrência criada
- Recorrência cancelada
- Pagamento recorrente confirmado
- Pagamento recorrente falhou

### 7.4 Melhor Envio

**Finalidade:** Cálculo de frete

**Funcionamento:**
- Cliente informa CEP no checkout
- Sistema consulta API com:
  - CEP origem (Kaza Tem)
  - CEP destino (cliente)
  - Peso e dimensões dos produtos
- API retorna opções de frete (PAC, SEDEX, etc) com:
  - Preço
  - Prazo de entrega
- Cliente escolhe opção preferida

**Observação:** Verificar se Bling já tem integração com Melhor Envio para evitar duplicidade

---

## 8. SISTEMA DE COMISSIONAMENTO

### 8.1 Modelo de Comissionamento

**Tipo:** Comissão progressiva mensal sobre valor de vendas

**Funcionamento:**
1. Revendedor vende através do seu link único
2. Sistema calcula comissão quando pedido é pago
3. Comissão fica "pendente" por 30 dias (período de devolução/cancelamento)
4. Após 30 dias, comissão fica "disponível" para saque
5. Revendedor solicita saque quando atingir mínimo de R$ 50,00

### 8.2 Faixas de Comissão

| Vendas no Mês (acumulado) | Percentual de Comissão |
|---------------------------|------------------------|
| R$ 0 a R$ 1.000           | 10%                    |
| R$ 1.001 a R$ 2.000       | 15%                    |
| R$ 2.001 a R$ 5.000       | 20%                    |
| Acima de R$ 5.000         | 30%                    |

**Exemplo:**
- Revendedor vendeu R$ 3.500 no mês
- Comissão: R$ 3.500 × 20% = R$ 700,00
- Se no mesmo mês vender mais R$ 2.000 (total R$ 5.500)
- Nova comissão: R$ 5.500 × 30% = R$ 1.650,00

### 8.3 Exemplo Prático de Comissão

**Cenário:**
- Cliente clicou no link do Paulo no dia 10/01
- Cliente comprou R$ 500 em produtos no dia 12/01
- Frete: R$ 30
- Total do pedido: R$ 530

**Cálculo:**
- Base de comissão: R$ 500 (produto) - R$ 0 (frete não conta) = R$ 500
- Paulo já tinha R$ 800 em vendas no mês de janeiro
- Total do mês de Paulo: R$ 1.300
- Faixa: R$ 1.001 a R$ 2.000 = 15%
- Comissão desta venda: R$ 500 × 15% = R$ 75,00
- Status: PENDENTE por 30 dias
- Em 12/02, comissão muda para DISPONÍVEL
- Paulo pode solicitar saque

### 8.4 Situações Especiais

**Cancelamento de Pedido:**
- Se pedido for cancelado, comissão é revertida
- Se já estava disponível, desconta do saldo
- Se já foi sacada, fica como "débito" para próximas comissões

**Devolução Parcial:**
- Comissão é recalculada proporcionalmente
- Apenas produtos devolvidos têm comissão revertida

**Pedido Fraudulento:**
- Admin pode marcar pedido como fraudulento
- Comissão é zerada e revendedor é notificado

---

## 9. SISTEMA DE NÍVEIS DE REVENDEDOR

### 9.1 Propósito

Criar gamificação e reconhecimento para revendedores de alto desempenho, incentivando crescimento de vendas.

### 9.2 Níveis e Critérios

| Nível  | Vendas nos Últimos 12 Meses | Cor do Badge | Benefícios                           |
|--------|----------------------------|--------------|--------------------------------------|
| Bronze | R$ 0 a R$ 50.000           | 🥉 Bronze    | Acesso a materiais básicos           |
| Prata  | R$ 50.001 a R$ 150.000     | 🥈 Prata     | Materiais exclusivos + Brinde        |
| Ouro   | Acima de R$ 150.000        | 🥇 Ouro      | Materiais VIP + Kit de brindes       |

### 9.3 Regras

- Cálculo baseado em **vendas totais** (não comissão) dos últimos 12 meses
- Recálculo automático todo dia 1º do mês
- Revendedor pode subir ou descer de nível conforme performance
- Nível não afeta percentual de comissão (que é mensal)
- Badge do nível aparece no dashboard do revendedor

### 9.4 Exemplo Prático

**Paulo - Revendedor:**
- Janeiro 2025: Vendeu R$ 5.000
- Fevereiro 2025: Vendeu R$ 8.000
- ...
- Dezembro 2025: Vendeu R$ 4.000
- **Total 12 meses:** R$ 55.000
- **Nível em Janeiro 2026:** Prata 🥈

---

## 10. ASSINATURA MENSAL

### 10.1 Modelo de Assinatura

**Valor:** R$ 9,90 por mês  
**Forma de Pagamento:** Cartão de crédito (recorrência automática via Cielo)  
**Renovação:** Automática todo mês  
**Cancelamento:** Pode ser feito a qualquer momento  

### 10.2 Fluxo de Pagamento

**Primeira Cobrança:**
- No momento da ativação do cadastro aprovado
- Revendedor informa dados do cartão
- Cielo processa pagamento
- Se aprovado → Status "ativo"
- Se negado → Revendedor pode tentar novamente

**Cobranças Mensais:**
- Automáticas todo dia XX do mês (dia que assinou)
- Notificação por email 3 dias antes
- Se aprovado → Continua ativo
- Se negado → Status "suspenso"

**Inadimplência:**
- Após primeira falha: Status "suspenso" por 7 dias
- Email de notificação enviado
- Revendedor pode atualizar cartão e tentar novamente
- Se não pagar em 7 dias → Status "cancelado"
- Comissões pendentes/disponíveis são mantidas

### 10.3 Cancelamento

**Pelo Revendedor:**
- Pode cancelar a qualquer momento no dashboard
- Cancelamento entra em vigor no próximo ciclo
- Até o fim do período pago, continua ativo
- Não há reembolso proporcional

**Pela Empresa:**
- Admin pode cancelar assinatura em casos de fraude ou violação de termos
- Revendedor é notificado por email

---

## 11. SISTEMA DE SAQUES

### 11.1 Requisitos para Saque

- Ter saldo "disponível" de no mínimo R$ 50,00
- Não ter outro saque pendente
- Estar com assinatura ativa
- Ter dados bancários cadastrados

### 11.2 Processo de Saque

1. **Solicitação:** Revendedor solicita via dashboard
2. **Validação:** Sistema valida saldo e dados bancários
3. **Aprovação:** Admin analisa e aprova/rejeita manualmente
4. **Integração Bling:** Sistema cria "conta a pagar" no Bling
5. **Pagamento:** Admin efetua transferência bancária manualmente
6. **Confirmação:** Admin marca saque como "pago" no sistema
7. **Notificação:** Revendedor recebe email de confirmação

### 11.3 Prazos

- **Análise:** Até 2 dias úteis após solicitação
- **Pagamento:** Até 5 dias úteis após aprovação
- **Prazo total:** Até 7 dias úteis

### 11.4 Taxas

- **Sem taxa** para saques

### 11.5 Histórico

Revendedor pode visualizar:
- Saques solicitados (pendentes)
- Saques aprovados (aguardando pagamento)
- Saques pagos (com data e valor)
- Saques rejeitados (com motivo)

---

## 12. MATERIAIS DE MARKETING

### 12.1 Tipos de Materiais

**Imagens de Produtos:**
- Fotos em alta resolução
- Fundo branco
- Múltiplos ângulos
- Uso: Posts em redes sociais

**Banners Promocionais:**
- Para stories Instagram (1080x1920)
- Para feed Instagram (1080x1080)
- Para Facebook (1200x628)
- Uso: Anúncios e posts patrocinados

**Catálogos:**
- PDF com todos os produtos
- Organizado por categoria
- Com preços atualizados
- Uso: Envio via WhatsApp

**Sugestões de Copy:**
- Textos prontos para posts
- Legendas criativas
- Hashtags relevantes
- Uso: Facilitar criação de conteúdo

### 12.2 Acesso e Download

- Revendedor acessa via dashboard
- Materiais organizados por categoria
- Download individual ou em lote
- Sem limite de downloads

### 12.3 Atualização

- Admin pode adicionar novos materiais a qualquer momento
- Revendedores são notificados quando há novidades
- Materiais desatualizados são arquivados (não removidos)

---

## 13. SISTEMA DE CUPONS

### 13.1 Criação de Cupons

**Quem pode criar:**
- Revendedor (para seu próprio link)
- Administrador (cupons globais)

**Configurações:**
- Código do cupom (ex: PAULO10, PROMO20)
- Tipo de desconto: Percentual ou Valor fixo
- Valor: Máximo 10% ou R$ 50,00 (o que for menor)
- Validade: Data de início e fim
- Limite de uso: Ilimitado ou X vezes

### 13.2 Uso de Cupons

**Cliente:**
- Informa código no checkout
- Sistema valida cupom
- Desconto é aplicado no total

**Revendedor:**
- Cupom só funciona se compra vier pelo seu link
- Acompanha quantas vezes foi usado
- Ve valor total de desconto concedido

**Regras:**
- 1 cupom por pedido
- Desconto reduz base de cálculo da comissão
- Cupom expirado não pode ser usado

### 13.3 Exemplo Prático

**Paulo cria cupom:**
- Código: PAULO10
- Desconto: 10%
- Validade: 01/02 a 28/02
- Limite: Ilimitado

**Cliente usa:**
- Carrinho: R$ 500
- Aplica PAULO10
- Desconto: R$ 50
- Total: R$ 450
- Comissão de Paulo: Calculada sobre R$ 450 (não R$ 500)

---

## 14. PRECIFICAÇÃO PERSONALIZADA

### 14.1 Conceito

Permite que revendedor defina preços customizados para produtos, **sempre acima** do preço base do site.

### 14.2 Regra de Ouro

⚠️ **CRÍTICO:** Preço customizado **NUNCA** pode ser menor que preço base

**Exemplos:**
- Preço base: R$ 100
- ✅ Revendedor pode vender por R$ 120 (diferença fica com ele)
- ❌ Revendedor NÃO pode vender por R$ 90 (menor que base)

### 14.3 Habilitação

- Funcionalidade desabilitada por padrão
- Admin habilita manualmente para revendedores específicos
- Critérios: Confiança, performance, tempo de casa

### 14.4 Funcionamento

**Sem precificação personalizada:**
- Cliente vê preço base: R$ 100
- Revendedor ganha comissão sobre R$ 100

**Com precificação personalizada:**
- Revendedor define preço: R$ 120
- Cliente (vindo pelo link) vê: R$ 120
- Cliente paga: R$ 120
- Comissão calculada sobre: R$ 100 (preço base)
- Diferença (R$ 20) fica com o revendedor

### 14.5 Vantagens para Revendedor

- Margem extra além da comissão
- Flexibilidade para negociar com clientes
- Ganho maior em vendas de alto valor

### 14.6 Controle

- Admin pode desabilitar a qualquer momento
- Relatório de diferenças de preço (auditoria)
- Se detectar abuso, desabilita automaticamente

---

## 15. RELATÓRIOS E MÉTRICAS

### 15.1 Dashboard do Revendedor

**Métricas Principais:**
- Total vendido (mês atual, mês passado, total)
- Comissão acumulada (pendente e disponível)
- Número de visitas ao link (hoje, semana, mês)
- Taxa de conversão (visitas → vendas)
- Ticket médio

**Gráficos:**
- Vendas ao longo do tempo (linha)
- Vendas por categoria (pizza)
- Comissões mensais (barras)

**Tabelas:**
- Últimas 10 vendas
- Últimas 10 comissões
- Produtos mais vendidos

### 15.2 Dashboard Administrativo

**Visão Geral:**
- Total de vendas (dia, semana, mês, ano)
- Total de pedidos
- Ticket médio
- Taxa de conversão global
- Total de revendedores ativos

**Vendas:**
- Vendas diretas vs vendas por revendedores
- Produtos mais vendidos
- Categorias mais vendidas
- Vendas por região (baseado em CEP)

**Revendedores:**
- Top 10 revendedores (por volume de vendas)
- Novos cadastros pendentes
- Saques pendentes de aprovação
- Distribuição por nível (Bronze, Prata, Ouro)

**Comissões:**
- Total pago em comissões (mês, ano)
- Total pendente
- Total disponível
- Projeção de comissões futuras

**Financeiro:**
- Receita de assinaturas mensais
- Receita de vendas (total)
- Margem de lucro (vendas - custos - comissões)

### 15.3 Relatórios Exportáveis

**Formatos:** Excel, CSV, PDF

**Tipos:**
- Relatório de vendas por período
- Relatório de comissões pagas
- Relatório de revendedores (cadastros, performance)
- Relatório de saques processados
- Relatório financeiro consolidado

---

## 16. REQUISITOS NÃO-FUNCIONAIS

### 16.1 Performance

- Página inicial deve carregar em até 2 segundos
- Busca de produtos deve retornar resultados em até 1 segundo
- Checkout deve processar em até 3 segundos
- Sincronização de produtos não deve impactar performance do site

### 16.2 Segurança

- Dados de cartão de crédito nunca armazenados (PCI Compliance via Cielo)
- Senhas criptografadas (hash bcrypt)
- Comunicação HTTPS em todo o site
- Proteção contra SQL Injection
- Proteção contra XSS
- Rate limiting em APIs para evitar abuso
- Validação de CPF contra fraudes

### 16.3 Disponibilidade

- Sistema deve estar disponível 99% do tempo (permitido 7 horas de downtime/mês)
- Backup diário do banco de dados
- Plano de recuperação de desastres

### 16.4 Usabilidade

- Interface intuitiva e auto-explicativa
- Design responsivo (mobile, tablet, desktop)
- Compatível com navegadores: Chrome, Firefox, Safari, Edge (últimas 2 versões)
- Acessibilidade básica (WCAG 2.0 Level A)

### 16.5 Escalabilidade

- Suportar até 10.000 produtos cadastrados
- Suportar até 1.000 revendedores ativos simultâneos
- Suportar até 100 pedidos por hora
- Possibilidade de escalar horizontalmente conforme crescimento

### 16.6 Manutenibilidade

- Código documentado
- Arquitetura modular para facilitar manutenção
- Logs de erros e eventos importantes
- Versionamento de código (Git)

### 16.7 Conformidade Legal

- LGPD: Consentimento explícito para uso de dados
- Política de privacidade clara
- Termos de uso para revendedores e clientes
- Nota fiscal eletrônica para todas as vendas
- Emissão de recibo para pagamentos de comissão

---

## 17. GLOSSÁRIO

**Agregado (Aggregate):** Entidade principal que agrupa outras entidades relacionadas  
**Base de Cálculo:** Valor sobre o qual a comissão é calculada (Total - Frete)  
**Bounded Context:** Contexto delimitado que agrupa funcionalidades relacionadas  
**Checkout:** Processo de finalização de compra  
**Comissão Disponível:** Comissão que já passou o período de carência e pode ser sacada  
**Comissão Pendente:** Comissão que ainda está no período de carência  
**CPF:** Cadastro de Pessoa Física  
**Dashboard:** Painel de controle com métricas e informações  
**Gateway de Pagamento:** Serviço que processa pagamentos (ex: Cielo)  
**Link Único:** URL personalizada do revendedor para rastreamento  
**Marketplace:** Plataforma que conecta vendedores e compradores  
**Recorrência:** Cobrança automática que se repete periodicamente  
**SKU:** Stock Keeping Unit - Código único de produto  
**Ticket Médio:** Valor médio de cada venda  
**Webhook:** Notificação automática enviada por sistema externo  

---

## 18. CRITÉRIOS DE ACEITE

### 18.1 E-commerce

- [ ] Cliente consegue navegar e buscar produtos
- [ ] Cliente consegue adicionar produtos ao carrinho
- [ ] Cliente consegue calcular frete informando CEP
- [ ] Cliente consegue finalizar compra com cartão de crédito
- [ ] Cliente consegue parcelar em até 12x
- [ ] Cliente recebe email de confirmação após compra
- [ ] Pedido é criado no Bling automaticamente

### 18.2 Revendedores

- [ ] Pessoa consegue se cadastrar como revendedor
- [ ] Admin consegue aprovar/rejeitar cadastros
- [ ] Revendedor consegue criar assinatura mensal
- [ ] Revendedor recebe link único funcional
- [ ] Vendas pelo link são rastreadas corretamente
- [ ] Comissões são calculadas automaticamente
- [ ] Comissões ficam pendentes por 30 dias
- [ ] Revendedor consegue solicitar saque
- [ ] Admin consegue aprovar saques
- [ ] Saque aprovado cria conta a pagar no Bling

### 18.3 Dashboard

- [ ] Revendedor vê métricas em tempo real
- [ ] Revendedor vê gráficos de vendas
- [ ] Revendedor vê histórico de comissões
- [ ] Admin vê dashboard geral do negócio
- [ ] Admin vê lista de cadastros pendentes
- [ ] Admin vê lista de saques pendentes

### 18.4 Integrações

- [ ] Produtos sincronizam do Bling automaticamente
- [ ] Imagens sincronizam do Magis5 automaticamente
- [ ] Pedidos são criados no Bling após pagamento
- [ ] Pagamentos via Cielo funcionam corretamente
- [ ] Frete é calculado via Melhor Envio

---

## 19. FASES DE IMPLEMENTAÇÃO (ROADMAP)

### Fase 1: E-commerce Básico (MVP) - 4 semanas
- Catálogo de produtos
- Busca e filtros
- Carrinho de compras
- Checkout com Cielo
- Integração Bling (produtos)
- Integração Magis5 (imagens)

### Fase 2: Sistema de Revendedores - 3 semanas
- Cadastro de revendedores
- Aprovação manual
- Sistema de assinatura (Cielo Recorrência)
- Geração de link único

### Fase 3: Rastreamento e Comissões - 2 semanas
- Rastreamento de visitas/vendas
- Cálculo automático de comissões
- Sistema de períodos (pendente/disponível)

### Fase 4: Dashboard Revendedor - 2 semanas
- Métricas e gráficos
- Histórico de vendas
- Saldo de comissões

### Fase 5: Sistema de Saques - 1 semana
- Solicitação de saque
- Aprovação manual
- Integração com Bling (contas a pagar)

### Fase 6: Dashboard Admin - 2 semanas
- Gestão de cadastros
- Gestão de saques
- Relatórios e métricas

### Fase 7: Materiais e Cupons - 1 semana
- Banco de materiais
- Sistema de cupons

### Fase 8: Funcionalidades Avançadas - 2 semanas
- Níveis de revendedor
- Precificação personalizada
- Relatórios avançados

**Total: ~17 semanas (4 meses)**

---

## 20. RISCOS E MITIGAÇÕES

### 20.1 Riscos Técnicos

**Risco:** Integração com Bling pode ser instável  
**Mitigação:** Implementar retry logic e logs detalhados

**Risco:** Alto volume de revendedores pode sobrecarregar sistema  
**Mitigação:** Arquitetura escalável com cache e otimizações

**Risco:** Fraude em comissões (revendedor comprando pelo próprio link)  
**Mitigação:** Validação de CPF, análise de padrões suspeitos, regra anti-fraude

### 20.2 Riscos de Negócio

**Risco:** Revendedores não aderirem ao programa  
**Mitigação:** Comissões atrativas, materiais de qualidade, suporte dedicado

**Risco:** Inadimplência nas assinaturas  
**Mitigação:** Suspensão automática, comunicação clara, facilidade de pagamento

**Risco:** Clientes preferindo comprar direto (sem link)  
**Mitigação:** Incentivos exclusivos via revendedores (cupons personalizados)

### 20.3 Riscos Legais

**Risco:** Não conformidade com LGPD  
**Mitigação:** Consultoria jurídica, termos claros, opt-in explícito

**Risco:** Problemas trabalhistas com revendedores  
**Mitigação:** Contrato de afiliação claro (não vínculo empregatício)

---

## 21. ANEXOS

### 21.1 Exemplo de Email - Cadastro Aprovado

```
Assunto: Seu cadastro foi aprovado! Bem-vindo à Kaza Tem 🎉

Olá Paulo,

Parabéns! Seu cadastro como revendedor Kaza Tem foi aprovado.

Próximos passos:
1. Acesse sua conta: kazatem.shop/login
2. Crie sua assinatura mensal (R$ 9,90/mês)
3. Receba seu link único de vendas
4. Comece a vender e ganhar comissões!

Seu link será: kazatem.shop/r/PAULO_ABC123

Dúvidas? Responda este email ou acesse nossa Central de Ajuda.

Equipe Kaza Tem
```

### 21.2 Exemplo de Email - Saque Aprovado

```
Assunto: Seu saque foi aprovado! 💰

Olá Paulo,

Seu saque de R$ 250,00 foi aprovado!

Detalhes:
- Valor: R$ 250,00
- Banco: Banco do Brasil
- Agência: 1234-5
- Conta: 67890-1

O pagamento será processado em até 5 dias úteis.

Você receberá um novo email quando o pagamento for confirmado.

Equipe Kaza Tem
```

---

## 22. APROVAÇÃO

Este documento de requisitos deve ser revisado e aprovado pelos stakeholders:

**Aprovadores:**
- [ ] Dono/Sócio da Kaza Tem Imports
- [ ] Gerente Comercial
- [ ] Gerente Financeiro
- [ ] Equipe de Desenvolvimento (validação de viabilidade)

**Versão:** 1.0  
**Data de Criação:** Janeiro 2025  
**Última Atualização:** Janeiro 2025  

---

**FIM DO DOCUMENTO DE REQUISITOS**

Este documento descreve APENAS o que o sistema deve fazer (requisitos funcionais e de negócio).  
Para detalhes técnicos de implementação, consultar documento separado: REQUISITOS_KAZA_TEM_SYSTEM.md
