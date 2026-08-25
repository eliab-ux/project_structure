# Módulos de Implementação - KAZA TEM

Este diretório contém a documentação de cada módulo a ser implementado, separados por prioridade e fase.

## Ordem de Implementação

### FASE 1 - Core E-commerce (Prioridade CRÍTICA)
| # | Módulo | Arquivo | Dependências |
|---|--------|---------|--------------|
| 1 | Order Context | [01-ORDER-CONTEXT.md](./01-ORDER-CONTEXT.md) | Product, User |
| 2 | Integração Cielo | [02-INTEGRACAO-CIELO.md](./02-INTEGRACAO-CIELO.md) | Order |
| 3 | Integração Melhor Envio | [03-INTEGRACAO-MELHOR-ENVIO.md](./03-INTEGRACAO-MELHOR-ENVIO.md) | Order |
| 4 | Frontend Carrinho/Checkout | [04-FRONTEND-CHECKOUT.md](./04-FRONTEND-CHECKOUT.md) | Order, Cielo, Melhor Envio |

### FASE 2 - Sistema de Comissões (Prioridade ALTA)
| # | Módulo | Arquivo | Dependências |
|---|--------|---------|--------------|
| 5 | Analytics Context | [05-ANALYTICS-CONTEXT.md](./05-ANALYTICS-CONTEXT.md) | Reseller |
| 6 | Commission Context | [06-COMMISSION-CONTEXT.md](./06-COMMISSION-CONTEXT.md) | Order, Analytics |
| 7 | Frontend Dashboard Real | [07-FRONTEND-DASHBOARD.md](./07-FRONTEND-DASHBOARD.md) | Analytics, Commission |

### FASE 3 - Assinaturas e Saques (Prioridade MÉDIA)
| # | Módulo | Arquivo | Dependências |
|---|--------|---------|--------------|
| 8 | Subscription Context | [08-SUBSCRIPTION-CONTEXT.md](./08-SUBSCRIPTION-CONTEXT.md) | Cielo Recorrência |
| 9 | Withdrawal Context | [09-WITHDRAWAL-CONTEXT.md](./09-WITHDRAWAL-CONTEXT.md) | Commission, Bling |
| 10 | Frontend Assinaturas/Saques | [10-FRONTEND-SUBSCRIPTIONS.md](./10-FRONTEND-SUBSCRIPTIONS.md) | Subscription, Withdrawal |

### FASE 4 - Complementos (Prioridade BAIXA)
| # | Módulo | Arquivo | Dependências |
|---|--------|---------|--------------|
| 11 | Marketing Context | [11-MARKETING-CONTEXT.md](./11-MARKETING-CONTEXT.md) | - |
| 12 | Integração Bling Completa | [12-INTEGRACAO-BLING.md](./12-INTEGRACAO-BLING.md) | Order |
| 13 | Integração Magis5 | [13-INTEGRACAO-MAGIS5.md](./13-INTEGRACAO-MAGIS5.md) | Product |
| 14 | Frontend Admin | [14-FRONTEND-ADMIN.md](./14-FRONTEND-ADMIN.md) | Todos os contextos |

---

## Como usar

1. Escolha um módulo da lista acima (seguindo a ordem de prioridade)
2. Abra o arquivo correspondente
3. Siga as instruções de implementação
4. Após concluir, marque como ✅ e passe para o próximo

---

**Última atualização:** 03/02/2026
