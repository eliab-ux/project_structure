# VERTEX — Visão Geral do Sistema (documento de apoio para Claude Code)

> **Papel deste documento:** contexto obrigatório antes de trabalhar em QUALQUER módulo
> do Veertex. Os documentos por módulo (em `Requisitos/`) detalham cada entrega; este
> define o que o sistema É, as decisões que valem para todos, e o vocabulário.
> **Constituição técnica: `CLAUDE.md` do monorepo** — tudo aqui respeita e complementa;
> em conflito, avisar o Eliab antes de codificar.

---

## 1. O que é o Veertex

SaaS **ERP multi-tenant** para pequenas e médias empresas brasileiras. Tese de produto:
**a completude de um ERP grande com a usabilidade simples de mercado (referência Bling),
mais um diferencial que nenhum concorrente tem: venda em rota/consignação (mascate)**.

Nomes anteriores do projeto: ABN Vendas → RotaSales → **Veertex** (working title; domínio
e INPI pendentes de verificação — "Veertex" tem colisões conhecidas: Veertex Inc./fiscal,
Google Veertex AI).

**Sistemas de referência estudados no levantamento** (não copiar — absorvemos o melhor
de cada um): SuasVendas (completude; UX pesada — evitar), Bling (simplicidade,
configurações, produto, financeiro/DRE), TECCOMMERCE (operação real de rota da
Tudodicasa), planilhas reais de fechamento de viagem (massa de teste do motor de
comissões), Nexo (marketplace+expedição — será reconstruído; código em
repositório separado — **localização a ser fornecida pelo Eliab; NÃO está no monorepo** — ver §8).

## 2. Princípios de produto (valem para toda tela e todo endpoint)

1. **Modular estilo Protheus com UX SaaS:** módulos ativáveis por conta (toggle);
   plano define o teto; papel define a visão. `plano ∩ conta ∩ papel` = o que o usuário vê.
   Backend protege com guard de módulo (`@RequireModule('...')`); menu é dinâmico.
   Desativar módulo oculta UI/API mas **preserva dados** e motores internos.
2. **Telas por papel:** operador de caixa, representante, entregador, gestor, contador —
   cada um enxerga só o seu mundo. Complexidade existe, mas nunca para quem não a usa.
3. **Tudo é pedido:** venda de qualquer origem é UM `order` com `origin`
   (`erp|pdv|rota|vitrine|marketplace`) e `delivery_mode` (`retirada|envio|rota_entrega`).
4. **Aprovação em dois estágios é padrão da casa:** campo lança → escritório efetiva
   (rota); vitrine lança pré-pedido → representante autoriza; devolução/desconto no PDV →
   gerente aprova (presencial OU remoto por e-mail/WhatsApp).
5. **Nunca prender dados do cliente:** exportação sempre disponível; cancelamento de
   conta em etapas com download prévio (padrão Bling).
6. **Conector é port & adapter, sempre:** TEF, Pix, boleto, frete, marketplace, fiscal.
   Trocar provedor = configuração. Nenhum `if (provedor === ...)` fora de adapter.

## 3. Arquitetura e stack (deltas sobre o CLAUDE.md)

O CLAUDE.md do monorepo define a arquitetura (NestJS+Fastify+MikroORM, hexagonal,
Next.js 14+MUI, JWT próprio, identificadores em inglês). **Deltas do Veertex:**

| Item | CLAUDE.md sugere | Veertex usa |
|---|---|---|
| Banco | Supabase (sugestão padrão) | **PostgreSQL self-hosted no servidor mdantas** (driver `postgresql`, conexão direta; migrations MikroORM versionadas) |
| Storage | Supabase Storage | **MinIO** (fotos de produto, evidências da rota, XMLs, PDFs) |
| Filas | — | **Redis + BullMQ** (sincronizações, notificações, geocodificação) |

- **Multi-tenancy: banco ÚNICO + `account_id` em toda tabela (pool model).**
  Camadas de proteção obrigatórias: RLS por `account_id`; usuário de runtime SEM
  DDL/TRUNCATE/DELETE fora de policy; soft delete nas entidades de negócio; PITR.
  "Instância dedicada" existe apenas como add-on comercial (mesma codebase, connection
  string própria). Banco-por-cliente (modelo SuasVendas) foi avaliado e DESCARTADO.
- **Multi-CNPJ SEM hierarquia:** N empresas paralelas por conta; **estoque segregado
  por CNPJ** (sem visão unificada); transferência entre CNPJs é operação FISCAL (NF);
  entre depósitos do mesmo CNPJ é livre. Depósito pertence a 1 CNPJ; NF sai com os
  dados do CNPJ do depósito expedidor. **CNPJ/empresa é dimensão analítica: todo
  relatório filtra e compara por empresa.**
- **"Personalizar Campos":** colunas reais nullable + tabela `field_config`
  (conta+entidade+campo → visível/obrigatório/rótulo/ordem). Proibido EAV/JSONB genérico.
- **Contatos unificados com tipos** (cliente/fornecedor/transportador/vendedor/
  revendedor no mesmo cadastro — modelo Bling).
- **Identificadores de código e banco em INGLÊS** (glossário pt→en na seção 7).
- Regra do CLAUDE.md que impacta cadastros: **toda entidade autenticável tem nome,
  e-mail e WhatsApp obrigatórios** (`PhoneE164`) — vale para usuários, representantes,
  gerentes; recuperação de senha por código no WhatsApp.

## 4. Catálogo de módulos e escopo da V1

**V1 (aprovada pelo Eliab):**
| Módulo | Conteúdo essencial |
|---|---|
| **CORE** | Conta, empresas (CNPJs), usuários/papéis granulares, contatos unificados, produtos (com kit comercial), field_config, ativação de módulos, dashboard |
| **VND** | Orçamentos/pedidos, tabelas de preço multi-canal com degrau por quantidade, motor de comissões (seção 5), calculadora de precificação |
| **EST** | Estoque multi-local por CNPJ, trilha de movimentos, inventário, transferências |
| **ROT** | Rota/consignação completa + app do representante (seção 5) |
| **FIN (básico)** | Contas a pagar/receber, categorias com mapeamento p/ DRE, fluxo de caixa |
| **COB** | Crediário/promissórias (com política "perdida"), boletos via agregador |
| **FIS** | NF-e/NFC-e com contingência; regimes Simples + Normal + MEI |
| **CAN** | Marketplace (reconstrução do Nexo; 1º adapter = o que o Nexo usa/Magis5 ou Meli — confirmar no código) |
| **EXP** | Expedição (reconstrução do Nexo): fila por origem, separação/conferência, etiqueta, despacho |

**Ondas seguintes:** PDV (spec pronta), PRD (produção COM etapas por produto — spec
pronta), ENT (rotas de entrega/otimização), CRM/Funil/Agenda, Vitrine do representante,
CMP (compras com conferência por XML), OS + contratos/recorrência, CTB (contador), API
pública, COM completo (a engine de notificação nasce na V1 no mínimo p/ aprovações
remotas e boletos).

**CAN e EXP são módulos SEPARADOS com integração de primeira classe** (pedido do canal
cai direto na fila de expedição). Decisão: expedição serve todas as origens, não só
marketplace; o plano "Digital" os agrupa comercialmente.

## 5. O coração: módulo de Rota (resumo executivo — detalhe no MD do módulo)

**Glossário:** REPRESENTANTE leva mercadoria consignada ao REVENDEDOR (cliente da ponta
que revende); AJUDANTE opcional viaja junto (remuneração FIXA SEMANAL, não vende);
GERENTE supervisiona rota E loja.

**Ciclo:** Viagem N consigna (pedido nominal por revendedor, item a item, no app;
promissória impressa na ponta como garantia) → ~60 dias → Viagem N+1 acerta: pagou
(vira venda) / devolveu / trocou (par entrada+saída) / rolou (recobrança). Campo lança;
escritório confere e efetiva. Título sem recebimento após 1 cobrança + 3 recobranças
(configurável) vira "perdida": sai da carteira de viagem, permanece no financeiro até
baixa manual (cancelar ou lançar como despesa).

**Comissões (motor FECHADO — validar contra planilhas reais, bater no centavo):**
- Modelo por CADASTRO do vendedor. **Modelo A (loja):** escala de meta
  (vendido÷meta → faixas abertas >100%). **Modelo B (rota):** escala de recebimento
  (recebido÷carteira → % direto; faixas customizáveis; ex. ≥90%→8%).
- Revendedor: % individual, via **desconto no acerto** (paga já líquido). Base do
  representante = recebido LÍQUIDO da comissão do revendedor.
- Gerente: DOIS percentuais simultâneos (X% loja + Y% rota). Comissões → contas a pagar.

**App do representante:** OFFLINE-FIRST (obrigatório); GPS capturado NA ABERTURA do
pedido (imutável; alteração só por ação explícita, auditada); foto-comprovante e foto
da promissória; impressão térmica portátil + comprovante WhatsApp/PDF; rastreamento do
representante ligado ao status da viagem (LGPD/consentimento). Tecnologia: A DEFINIR no
MD do módulo (candidatos: Ionic React+Capacitor [stack LouvorApp — melhor p/ impressora
térmica/GPS] × PWA Next.js; levar recomendação ao Eliab).

## 6. Conformidades e integrações críticas

- **IN 1608/25 (GO):** pagamento eletrônico ↔ NFC-e vinculados e atômicos no PDV
  (quando o PDV entrar) — mas a estrutura de `order_payment` com bloco TEF
  (provedor/NSU/autorização/bandeira/credenciadora_cnpj) nasce na V1.
- TEF/Pix: ports desde o dia 1; 1º adapter TEF puxado pelo 1º cliente real;
  Pix dinâmico (Sicoob é candidato natural).
- Boletos: v1 via AGREGADOR (Kobana/TecnoSpeed/Asaas — escolher na implementação);
  régua de cobrança automatizada usa a engine de notificação.
- Frete: Correios PPN direto E agregador simultâneos; `CotarFrete` único (vitrine/ERP/
  PDV); fallback tabela própria → manual; snapshot da cotação no pedido.
- Migrador SuasVendas: doc oficial
  https://documenter.getpostman.com/view/8635750/TVzYeZFu (token no painel do cliente).

## 7. Glossário pt→en (identificadores)

conta→`account` · empresa/CNPJ→`company` · usuário→`user` · papel→`role` ·
contato→`contact` · produto→`product` · kit→`product_bundle` · tabela de preço→
`price_list` · pedido→`order` · item→`order_item` · pagamento→`order_payment` ·
depósito/local→`warehouse` · movimento de estoque→`stock_movement` · viagem→`trip` ·
rota (região)→`route` · romaneio/carga→`trip_load` · representante→`sales_rep` ·
revendedor→`reseller` · ajudante→`trip_assistant` · gerente→`manager` ·
cobrança→`collection` · recobrança→`recollection` · promissória→`promissory_note` ·
parcela de crediário→`installment` · perdida→`written_off_pending`(status; write-off
manual = `written_off`) · comissão→`commission` · acerto→`settlement` ·
expedição→`fulfillment`/`shipment` · etiqueta→`shipping_label` · natureza de operação→
`operation_nature` · ficha técnica→`bill_of_materials` · ordem de produção→
`production_order` · etapa de produção→`production_step`.

## 8. Documentos por módulo (Requisitos/)

Cada módulo terá `Requisitos/NN_Veertex_<Modulo>.md` (numerados na ordem de construção: 00_Visao_Geral, 01_Core, 02_Vnd, 03_Est, 04_Rot, 05_Fin, 06_Cob, 07_Fis, 08_Can, 09_Exp) com: objetivo, papéis envolvidos,
regras de negócio (com exemplos numéricos quando houver — comissões têm massa de teste
real), entidades e relações (descritivas; SQL só na fatia de modelagem aprovada),
casos de uso, telas, integrações, critérios de aceite. **Marketplace (CAN) e Expedição
(EXP) incluem etapa prévia: analisar o código-fonte do NEXO (repositório separado, a ser
fornecido pelo Eliab — CONFIRMADO em 08/ago que NÃO está no monorepo nem no zip recebido,
que continha apenas o Kaza Tem) — mapear configuração
(itens colocados em configuração que pertencem ao produto, ex. CFOP), fluxo de
marketplace e fluxo de expedição; se o código local não contiver esses módulos,
REPORTAR ao Eliab antes de prosseguir (o zip recebido no levantamento continha apenas
o e-commerce Kaza Tem).**

## 9. Regras de conduta do desenvolvimento

1. Modelagem de dados: por fatia, com aprovação do Eliab fatia a fatia. Rascunhos do
   levantamento existem (em pt) — traduzir e revisar, não copiar cego.
2. Nada de silent defaults: qualquer valor/limite não especificado vira pergunta ou
   pendência explícita no MD do módulo — nunca hardcode calado.
3. Massa de teste do motor de comissões: as planilhas reais da Tudodicasa (abas
   03-07, 04-05...) — o cálculo implementado deve reproduzir os valores no centavo.
4. Handoff do levantamento (`Veertex_Handoff_Requisitos.md`) é a fonte de verdade dos
   requisitos; este documento é o mapa; o CLAUDE.md é a lei técnica.

---

## 10. Estrutura de pastas (DEFINIDA pelo Eliab — 08/ago)

- **Raiz do monorepo:** `C:\HD\Eliab\Veertex\`
- **TUDO do Veertex vive em ``** (`backend/` e `frontend/` dentro dela,
  seguindo o padrão do CLAUDE.md).
- **Fora de `` ficam APENAS os módulos compartilhados** (`packages/*` —
  domain-primitives, shared-kernel etc.).
- Documentos de módulo: `Requisitos/NN_Veertex_<Modulo>.md`.
- Grafia oficial do nome: **Veertex** (com dois "e"). Corrigir qualquer ocorrência
  de "Vertex" em código/docs.
