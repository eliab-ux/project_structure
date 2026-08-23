# 02_Veertex_Vnd.md — Módulo VND (Vendas)

> 🔁 **COMPLEMENTADO POR `02A_Veertex_Vnd_Complemento.md` (definitivo, validado contra o
> `Veertex_Handoff_Requisitos.md`).** Onde o 02A conflitar com este documento, **vale o 02A**.
> Já implementado deste complemento (change requests): **origem canônica**
> `{erp,pdv,rota,vitrine,marketplace}` + `delivery_mode` + `origin_detail` (§3.1) e o **estágio
> `orcamento`** de primeira classe com `valid_until` (§3.3). Ainda pendentes do 02A (próxima leva):
> `price_list`/`price_list_item` + resolução por prioridade (§3.2), `order_payment` TEF-ready (§4.1),
> condições de pagamento nomeadas (§4.2), motor de comissão Modelo A (§2 — o B só com o ROT). A
> comissão A/B foi **fechada** no 02A (a pendência §3.1 do 02 deixou de existir).

> ⚠️ **LEIA ANTES DE IMPLEMENTAR.** Este documento **não é baselinado**. Diferente do
> `00` e do `01`, ele não foi escrito a partir de levantamento com o Eliab — foi montado
> a partir das **referências a VND espalhadas no `01_Veertex_Core.md`** mais decisões de
> arquitetura já tomadas em sessão.
>
> O que está em **§2 (Ancorado)** tem fonte citada e pode ser implementado.
> O que está em **§3 (⚠️ DECISÃO)** não tem fonte. **Não preencher com default
> silencioso** — trazer como pergunta. Um pedido de venda é o coração de um ERP; errar
> o modelo aqui custa mais que em qualquer outra fatia.

---

## 1. Objetivo

Registrar e acompanhar a venda: pedido, itens, preço, condição, vendedor e comissão —
aplicando as regras que o CORE guarda mas não aplica (limite de crédito, carteirização) e
alimentando EST (baixa), FIN (recebimento) e FIS (emissão).

**Dependências declaradas (§3.7 do CORE):** `CAN → VND + EST`. VND não declara dependência
de outro módulo, mas o §3.4 e o §3.5 do CORE mostram acoplamento real com EST e FIN.

---

## 2. Ancorado nas fontes

### 2.1 Comissão do vendedor
**Fonte:** §3.3 do CORE — *"atributos de comissão vivem no user (modelo A/B, escalas, %
— detalhados em `02_Veertex_Vnd.md`)"*.

Ou seja: os atributos ficam no `user`, e a mecânica é deste documento. Existe **modelo A e
modelo B**, e existem **escalas**.
⚠️ O que A e B são, e como as escalas funcionam, **não está em nenhuma fonte disponível**
— ver §3.1.

### 2.2 Limite de crédito
**Fonte:** §3.4 do CORE — *"limite de crédito (**bloqueia venda acima** — módulos VND/COB
aplicam)"*.

O valor já está guardado no contato. A tela de Contato hoje declara que **ainda não
bloqueia**. Ao implementar o bloqueio aqui, esse aviso some sozinho (ele vem do backend
por `hint` e tem teste de contrato prendendo o texto).

### 2.3 Carteirização
**Fonte:** §3.4 do CORE — *"contato acessível somente ao vendedor vinculado = preferência
de carteirização"*.

Está **fora do CORE por decisão registrada**: campo de vendedor vinculado nem foi criado,
porque coluna sem filtro é falha de segurança que parece funcionalidade. Volta **inteira**
aqui: coluna, preferência da conta, e o filtro de fato.

**Requisito não negociável:** visibilidade de dado neste sistema mora em **RLS e guard**,
não em `if` de aplicação. Se a carteirização for filtro de aplicação, ela é contornável
por qualquer rota que esqueça de aplicá-la.

**Efeito colateral a corrigir:** hoje `SALES_REP` tem `contacts.read` e vê todos os
contatos da conta. É o correto na ausência de carteirização — e é exatamente o que muda
quando ela chegar.

### 2.4 Kit / `bundle`
**Fonte:** §3.5 do CORE — *"Estoque do kit deriva dos componentes (**baixa componentes ao
vender**)"*.

Fora de Produto por decisão registrada, aguardando EST. A **baixa** é do EST; a
**composição** e a decisão de o que o pedido registra (o kit, os componentes, ou os dois)
é deste documento — ver §3.4.

### 2.5 `field_config` sobre `order`
**Fonte:** §3.6 do CORE — entidades cobertas na V1 são `contact`, `product` e `order`, e
*"order consome em 02"*.

Portanto: o catálogo de campos de pedido é **fixo em código**, com `defaultVisible`
declarado campo a campo, e a config da conta governa exibição e obrigatoriedade — nunca
cria campo.

### 2.6 Numeração e segregação por empresa
**Fonte:** §3.2 do CORE — *"Estoque, numeração fiscal e emissão são POR empresa
(segregados)"* e *"Empresa é dimensão analítica obrigatória em todo relatório"*.

Todo pedido pertence a **uma empresa (CNPJ)**, e a numeração é por empresa.

⚠️ Contador por tenant+empresa sob RLS com concorrência é design próprio (lock ou sequence
dedicada), não um campo — mesmo problema que adiou a numeração sequencial de contato e o
SKU sequencial.

### 2.7 Dashboard
**Fonte:** §3.8 do CORE — cards *"vendas do período"*, *"pedidos por origem"* e *"top
produtos"*.

Isso impõe duas coisas ao modelo: o pedido tem **origem** (§3.1 abaixo), e há **data de
referência** para "período" — que pode não ser a data de criação.

### 2.8 Tabela de preço
**Fonte:** §3.3 e §3.4 do CORE — `price_list_id` no user e tabela de preço no contato,
ambos remetendo a `04_Veertex_Rot.md`.

**Fora deste documento.** A entidade pertence ao ROT. VND **consome** o preço resolvido.

### 2.9 Regras de projeto que valem aqui
- Toda tabela de negócio: `account_id NOT NULL` + RLS + cobertura no `verify:isolation`
  **no mesmo commit** da migration.
- O papel de runtime **não tem DELETE** — sincronização de coleção usa soft-delete.
- Comando de intenção separado por operação (`CreateOrder` / `UpdateOrder`), nunca upsert
  na Mesa: o humano precisa saber se vai criar ou alterar antes de aprovar.
- Nada persiste sem aprovação humana explícita.
- Campo que guarda valor sem aplicar regra **diz isso na tela**, não só no código.

---

## 3. Decisões

> **Fechadas por Eliab em 22/08/2026**, exceto a **3.1 (o que são os modelos A e B de comissão)**,
> que segue **pendente** — vem de levantamento ainda não feito. As sub-decisões de comissão que NÃO
> dependem de A/B foram fechadas (ver 3.1). O resto do VND não depende de saber o que A e B são.

### 3.1 Comissão: o que são o modelo A e o modelo B? ⚠️ PENDENTE
O §3.3 do CORE afirma que existem; a definição vem de levantamento com o Eliab, **ainda não feito**.
Hipóteses plausíveis (faturamento × recebimento; venda × margem; fixa × escalonada) dão modelos de
dados e momentos de apuração diferentes. **Decisão pendente do Eliab — não preencher.**

**Sub-decisões, já fechadas (independem de A/B):**
- comissão **gerada no faturamento** (não na emissão — ainda não é venda concluída; não no
  recebimento — acoplaria a FIN);
- **estornada** em cancelamento e em devolução;
- apurada **por item, com agregação no pedido**.

Por isso a comissão fica **por último** na ordem de implementação: a estrutura (quando gera, como
estorna, granularidade) está decidida, mas o **cálculo** espera A/B.

### 3.2 Situações do pedido
**DECISÃO:** `rascunho` → `confirmado` → `faturado` → `concluído`, mais `cancelado`. Gatilhos:
**reserva** de estoque em `confirmado` (§3.9), **baixa** e **título na FIN** em `faturado`.

> Nota de implementação: `faturado` **exige FIS/EST/FIN**, que não existem. O estado entra no enum
> (schema pronto), mas a transição para ele é **bloqueada com mensagem** enquanto esses módulos não
> existirem — mesmo padrão de "enum pronto, transição guarda loud" da numeração sequencial. O V1
> opera `rascunho → confirmado → concluído` + `cancelado`.

### 3.3 Origem do pedido
**DECISÃO — enum aberto, começando pelas que não dependem de CAN:** `balcao`, `representante`,
`telefone`, `importacao`. `loja_virtual` e `marketplace` entram com o CAN. Enum aberto (como o
`format` do produto) para não recusar o dado quando o canal chegar.

### 3.4 O que o pedido registra quando o item é kit
**DECISÃO: (c) registra os dois** — kit como pai, componentes como filhos. A NF-e e o picking
precisam dos componentes; o relatório comercial e o "top produtos" precisam do kit. (a) perde o
detalhe fiscal; (b) perde a leitura comercial; só (c) serve os três. *(Depende do EST para a baixa
dos componentes — a estrutura de itens já nasce pronta para o pai/filho.)*

### 3.5 Desconto
**DECISÃO: por item E por pedido, em % E em valor**, com **teto por PERMISSÃO granular**
(`orders.discount.grant`) — casa com a frase-âncora *"a Ana pode vender mas não pode dar desconto"*,
que é permissão, não número no usuário. Um teto percentual por papel, se necessário, é refinamento
posterior; a porta é a permissão.

### 3.6 Condição de pagamento e parcelas
**DECISÃO: o pedido carrega condição própria** (default herdado do contato, editável); as
**parcelas nascem no FIN** ao faturar. Assim o VND **não depende do FIN para existir** — só para
faturar —, mantendo o §3.7 do CORE (que não declara VND→FIN) honesto.

### 3.7 Frete
**DECISÃO: adapter próprio** (`FreightQuotePort` consumido pelo VND), **não um módulo**. Os dados do
produto já existem (o widget de completude verifica); a cotação é integração externa best-effort.

### 3.8 Devolução e cancelamento
**DECISÃO:** cancelamento **antes** da NF-e = operação de VND (muda a situação); **depois** da
NF-e = operação **fiscal** (FIS), padrão análogo ao §2.4 do 03. **Devolução** (mexe em estoque,
comissão e financeiro ao mesmo tempo) = operação própria coordenada, **só quando FIS e FIN
existirem**.

### 3.9 Reserva de estoque — decidida junto com o §3.3 do 03
**DECISÃO:** a reserva é um **tipo de movimento no EST** (append-only, coerente com o 03 §3.1
derivado) que **não altera o saldo físico, reduz o DISPONÍVEL**:
`disponível = SUM(movimentos) − SUM(reservas ativas)`. O VND emite a reserva na transição para
`confirmado`; ela é **liberada** por **cancelamento**, por **expiração** (TTL default **72h**) ou
por **faturamento** (vira baixa). Nenhum dos dois módulos guarda uma segunda verdade do saldo.

**Requisito (Eliab, 22/08/2026): a expiração gera EVENTO VISÍVEL.** Reserva que some sozinha é o
tipo de coisa que o vendedor descobre quando o cliente cobra. A liberação por expiração registra um
evento que aparece para o dono da carteira/pedido — não é um TTL silencioso.

---

## 4. Ordem sugerida de implementação

1. Fechar §3.1 a §3.9 com o Eliab. **Nenhuma linha de código antes.**
2. Pedido + itens + situações, sem comissão, sem estoque, sem financeiro.
3. Limite de crédito aplicado (o aviso do Contato some sozinho).
4. Carteirização inteira — preferência, coluna, e o filtro em RLS/guard.
5. Comissão, depois de §3.1 resolvido.
6. `field_config` sobre `order`.
7. Integração com EST (reserva/baixa) — coordenada com o `03`.

## 5. Critérios de aceite (a completar quando §3 fechar)

1. Pedido acima do limite de crédito do contato é bloqueado, com mensagem nomeando o
   limite e o excedente.
2. Com carteirização ligada, vendedor não enxerga contato de outro vendedor — verificado
   por teste de isolamento, não por inspeção de tela.
3. Numeração de pedido é por empresa e não colide sob concorrência.
4. Pedido sem empresa não é criável.
5. `field_config` marcando campo de pedido obrigatório faz a API rejeitar payload sem ele.
6. Zero violações do `CLAUDE.md`.
