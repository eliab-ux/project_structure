# 03_Veertex_Est.md — Módulo EST (Estoque)

> 🔁 **COMPLEMENTADO POR `03A_Veertex_Est_Complemento.md` (definitivo, 22/08/2026).** Onde o 03A
> conflitar com este documento, **vale o 03A**. Em especial: o saldo passou a ter **dimensão de
> localização** (`(empresa, produto, localização)`), toda empresa tem uma `warehouse` default,
> `stock_movements.location_id` é `NOT NULL`, existe **transferência interna** como par atômico, e o
> enum de tipos já reserva os movimentos do ROT. Decisão e desenho em **`ADR-0008_Localizacao_de_Estoque.md`**.
> A fatia de localizações do 03A é **pré-requisito do ROT** e foi implementada primeiro.

> ⚠️ **LEIA ANTES DE IMPLEMENTAR.** Este documento **não é baselinado** — foi montado a
> partir das referências a EST no `01_Veertex_Core.md` mais decisões já tomadas em sessão.
> **§2 (Ancorado)** tem fonte citada. **§3 (⚠️ DECISÃO)** não tem: trazer como pergunta,
> nunca preencher com default silencioso.
>
> ⚠️ **Numeração do arquivo a confirmar.** As fontes citam `02_Veertex_Vnd.md` e
> `04_Veertex_Rot.md`. O número do EST não aparece em nenhuma delas — `03` é suposição.

---

## 1. Objetivo

Manter o **saldo**, o **custo médio** e o **histórico de movimento** dos produtos, por
empresa. O CORE guarda os parâmetros do produto (mínimo, máximo, localização) e delega
tudo que é quantidade e custo para cá.

**Dependências declaradas (§3.7 do CORE):** `ROT → EST`, `PDV → EST`, `CAN → VND + EST`.
Três módulos dependem do EST — ele é infraestrutura, não funcionalidade isolada.

---

## 2. Ancorado nas fontes

### 2.1 Saldo vive aqui
**Fonte:** §3.5 do CORE — *"Estoque (parâmetros): mínimo/máximo, localização física;
**SALDO vive no EST**"*.

O produto guarda os parâmetros; o EST guarda a quantidade. Não duplicar: saldo em duas
tabelas diverge na primeira correção.

### 2.2 Custo médio é mantido aqui
**Fonte:** §3.5 do CORE — *"Custo médio mantido pelo EST; exibido aqui somente leitura"*.

A tela de Produto exibe, não edita. O cálculo é deste módulo, e muda a cada entrada.

### 2.3 Segregação por empresa
**Fonte:** §3.2 do CORE — *"**Estoque**, numeração fiscal e emissão são POR empresa
(segregados)"*.

Saldo é por `(empresa, produto)`, não por `(conta, produto)`. Duas empresas da mesma conta
têm estoques independentes do mesmo produto.

### 2.4 Transferência entre empresas é operação fiscal
**Fonte:** §3.2 do CORE — *"Transferência entre empresas = operação fiscal (módulo
EST/FIS)"*.

Não é ajuste de saldo: são empresas diferentes, com CNPJs diferentes. Sem FIS, a
transferência **não pode ser implementada como se fosse movimento interno** — seria criar
uma operação que a legislação trata como circulação de mercadoria sem o documento que ela
exige.

### 2.5 Kit deriva dos componentes
**Fonte:** §3.5 do CORE — *"Estoque do kit deriva dos componentes (baixa componentes ao
vender)"* e *"**Kit ≠ ficha técnica** (produção é outro módulo, invisível aqui)"*.

O kit **não tem saldo próprio**: o disponível é calculado a partir dos componentes. E não
há montagem física — kit é composição comercial, não ordem de produção.

### 2.6 Custo do fornecedor
**Fonte:** §3.5 do CORE — fornecedores do produto trazem `custo`, *"insumo da cotação de
compras (CMP futuro) e da calculadora de precificação"*.

Custo do fornecedor é dado do cadastro; custo médio é dado do movimento. São coisas
diferentes e não devem se sobrescrever.

### 2.7 Regras de projeto que valem aqui
- Toda tabela de negócio: `account_id NOT NULL` + RLS + cobertura no `verify:isolation`
  **no mesmo commit**.
- O papel de runtime **não tem DELETE**. Movimento de estoque é **append-only** por
  natureza — estorno é movimento novo, nunca exclusão. Isso conversa bem com o invariante.
- Saldo negativo, se permitido, é decisão explícita (§3.2), nunca consequência.
- Comandos de intenção separados por operação, nunca upsert na Mesa.

---

## 3. Decisões

> **Fechadas por Eliab em 22/08/2026**, exceto a **3.3 (reserva)**, que segue aberta até o
> `02_Veertex_Vnd.md` existir — é fronteira entre os dois módulos e decisão isolada produz
> inconsistência. O que era pergunta virou requisito; a 3.3 continua marcada como aberta.

### 3.1 Saldo: derivado ou materializado?
Duas arquiteturas incompatíveis:
- **(a) Derivado** — só a tabela de movimentos existe; saldo é `SUM()`. Sempre correto por
  construção, impossível de divergir, mas caro em leitura conforme o histórico cresce.
- **(b) Materializado** — tabela de saldo atualizada a cada movimento. Rápido, e é a
  segunda cópia da mesma verdade — que este projeto recusou três vezes.

**DECISÃO: (a) derivado.** O sinal para eventualmente migrar é observável (a listagem demorando),
não adivinhado hoje. Se um dia for (b), o saldo precisa de **verificação periódica contra os
movimentos**, e essa verificação precisa ser um gate que já foi visto falhando.

### 3.2 Estoque negativo é permitido?
Bloquear venda sem saldo é o esperado num ERP, e é o que evita vender o que não existe.
Mas trava operação real (venda com mercadoria a caminho, divergência de inventário).

**DECISÃO: bloquear por padrão, como PREFERÊNCIA da conta** (mesmo padrão das quatro do §1 do 01A).
Pedido sem saldo é **recusado**, não entra em espera — fila é fatia do `02` (VND), não do EST.

### 3.3 Reserva — DECIDIDA junto com o §3.9 do 02 (22/08/2026)
A reserva é um **tipo de movimento no EST** (append-only) que **não altera o saldo físico, reduz o
DISPONÍVEL**: `disponível = SUM(movimentos) − SUM(reservas ativas)`. O VND emite a reserva na
transição do pedido para `confirmado`; ela é liberada por **cancelamento**, **expiração**
(TTL default **72h**) ou **faturamento** (vira baixa). Nenhum dos dois módulos guarda uma segunda
verdade do saldo — que é o que mantém o §3.1 (derivado) coerente.

**Requisito: a expiração gera EVENTO VISÍVEL** (não é TTL silencioso — o vendedor não pode descobrir
a liberação só quando o cliente cobra). Ver §3.9 do `02_Veertex_Vnd.md`, onde esta decisão é gêmea.

**Implementação (22/08/2026): EXPIRAÇÃO PREGUIÇOSA.** A reserva vencida deixa de contar no disponível
(a consulta filtra `expires_at > now`) — o disponível já fica correto, e ninguém vê saldo errado, sem
agendador. É correto, não só conveniente: reserva vencida não deve reservar nada.

**Pendência com gatilho:** o EVENTO visível de expiração (marcar a reserva como `expired` e avisar o
dono) exige um agendador — e agendador só para isso é caro (gatilho 5, dependência nova). Entra
**junto com o BullMQ**, que a geocodificação assíncrona (§8 do 01A) já vai exigir. Não é "quando der":
é aquele momento. Até lá, a reserva vencida simplesmente não conta.

### 3.4 Método de custeio
"Custo médio" no §3.5 sugere média ponderada móvel.

**DECISÃO: média ponderada móvel, e a devolução reentra pelo CUSTO DA ÉPOCA do movimento original
(opção A).** Item que saiu por 10 e reentra por 20 inflaria a média e o valor do estoque, e o erro
vazaria para o CMV da venda seguinte — erro contábil que se propaga em silêncio é o pior tipo.

Consequências para o modelo de movimento (requisito, não nota):
- **A saída persiste o custo unitário que consumiu**, e a devolução **referencia o movimento de
  saída original** (`related_movement_id`) para reentrar por aquele custo. Reversão exata da venda:
  a média fica restaurada.
- **Estorno** segue a mesma regra — é reversão de um movimento específico, então a origem é sempre
  conhecida e o custo é o da época.
- **Fallback declarado:** quando a origem **não for achável** (devolução parcial, item que passou
  por vários preços, movimento antigo), reentra pela **média vigente** E o movimento **registra que
  usou fallback** (um flag na linha). O caso comum fica correto; a exceção fica **visível**, não
  silenciosa.
- **Entrada com custo zero** (bonificação/brinde): **DECISÃO — entra no cálculo e puxa a média para
  baixo.** É mercadoria efetivamente recebida; tratá-la fora do cálculo superestimaria o custo médio
  e, de novo, o CMV. *(Decidido por critério, sem fonte; tem efeito fiscal — reversível se o
  tratamento tributário da bonificação exigir outra conta.)*

### 3.5 Múltiplos depósitos por empresa
O §3.5 cita "localização física" como parâmetro do produto — que é texto descritivo, não depósito.

**DECISÃO: sem múltiplos depósitos no V1.** Saldo único por `(empresa, produto)`; "localização
física" continua texto. Depósito/almoxarifado é fatia própria (muda a PK do saldo e o modelo de
movimento) e entra depois, se houver demanda.

### 3.6 Tipos de movimento
**DECISÃO — enum inicial:** entrada por compra, saída por venda, ajuste de inventário, devolução de
cliente, devolução a fornecedor, perda. **Transferência entre empresas só com FIS** (§2.4). Cada
tipo tem regra própria de custo e de documento de origem.

### 3.7 Inventário
**DECISÃO: só ajuste unitário no V1.** Contagem/ajuste em lote é fatia própria e considerável —
entra depois.

### 3.8 Rastreio por lote e validade
O §3.5 do CORE cita **validade** como característica do produto.

**DECISÃO: validade é só informativa no cadastro no V1; controle de lote fica FORA.** Lote mudaria o
modelo inteiro de movimento e saldo — entra como fatia dedicada quando for requisito.

### 3.9 Unidade de compra × unidade de venda
O produto tem "itens por caixa" e DUN-14 (§3.5).

**DECISÃO: estoque sempre na UNIDADE BASE no V1.** Conversão caixa→unidade entra com compras (CMP).

---

## 4. Ordem sugerida de implementação

1. Fechar §3.1 a §3.9 com o Eliab, e §3.3 em conjunto com o `02`. **Zero código antes.**
2. Movimento append-only + saldo por `(empresa, produto)`, com os tipos de §3.6.
3. Custo médio, depois de §3.4 resolvido.
4. Disponível do kit derivado dos componentes — e aí o `bundle` volta ao Produto.
5. Alertas de mínimo/máximo, lendo os parâmetros que já existem no produto.
6. Integração com VND (reserva/baixa), coordenada.
7. Transferência entre empresas — **só quando FIS existir**.

## 5. Critérios de aceite (a completar quando §3 fechar)

1. Saldo é por empresa: mesma conta, duas empresas, mesmo produto, saldos independentes —
   verificado por teste.
2. Movimento é append-only: não existe caminho que apague ou altere movimento gravado.
3. Custo médio recalculado a cada entrada, e a tela de Produto o exibe somente leitura.
4. Disponível do kit deriva dos componentes; kit não tem saldo próprio.
5. Isolamento entre contas verificado com fixture plantada nas duas contas — asserção em
   tabela vazia passa com o RLS desligado e não prova nada.
6. Zero violações do `CLAUDE.md`.
