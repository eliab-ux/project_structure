# SPEC — Kortex · Sistema de Hora de Máquina de Corte

> **Documento de handoff para o Claude Code.** Fases 1 a 6.
> O Relatório de Atividades do governo (fase 7) **não** está aqui — depende das pendências
> listadas na seção 3.

---

## 0. Regras de execução — leia antes de escrever qualquer linha

1. **`CLAUDE.md` do monorepo é a constituição.** Este documento define **o quê**; o
   `CLAUDE.md` define **como**. Em qualquer conflito, o `CLAUDE.md` prevalece.
   Stack: NestJS 10 + Fastify + MikroORM 6 + PostgreSQL, frontend Next.js 14 + MUI,
   arquitetura hexagonal, Security by Design, DI por Symbol, `PhoneE164` obrigatório em
   entidade autenticável, recuperação de senha por código no WhatsApp.

2. **Execute UMA fase por vez.** Ao terminar, pare, apresente o Definition of Done
   preenchido e **espere aprovação** antes de começar a próxima. Não antecipe fase futura,
   não crie "estrutura preparatória" para fase não aprovada.

3. **Não invente campo, regra nem tela.** Se algo necessário não estiver aqui, **pare e
   pergunte**. Especificamente: os itens da seção 3 estão pendentes de terceiros e **não
   devem ser implementados** — nem como campo nullable "para depois".

4. **Não otimize as regras da seção 6.** Elas parecem redundantes e não são: cada uma
   existe por um motivo operacional registrado em entrevista. Se alguma parecer errada,
   pergunte em vez de "corrigir".

5. **Identificadores em inglês** (tabelas, colunas, classes, variáveis). **UI em
   português.** Comentários em português.

6. **Multiconta desde a fase 1.** Toda tabela de negócio tem `account_id` e todo
   repositório filtra por ele na camada de persistência. **Sem RLS** — o isolamento é
   feito na aplicação, via `accountId` extraído do JWT, nunca vindo do body/query.

---

## 1. O negócio em cinco linhas

Um dono de máquina robótica de corte de tecido vende **hora de máquina** para confecções da
região. O cliente não sabe quanto tempo precisa: quem estima é o **Modelista**, que avalia
tecido, metragem e quantidade de peças e diz quantas horas reservar. O **Administrativo**
reserva, cobra antecipado e só então o corte aparece na agenda do Modelista. O Modelista
executa (plotter → enfesto → corte) e aponta o que realmente aconteceu. O tempo real medido
alimenta o histórico por tecido, que é o parâmetro da próxima estimativa.

**Fonte:** transcrições de entrevista com o dono da operação (Ceres, GO — APL Arranjo
Produtivo Local), planilha de controle mensal e relatório nativo da máquina Audaces Neocut
Bravo.

---

## 2. Decisões fechadas

| #    | Decisão                                                              | Consequência técnica                                              |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 2.1  | Multiconta desde o início                                            | `account_id` em tudo; escopo na persistência                      |
| 2.2  | Venda em **hora cheia**                                              | Início alinhado em `:00`, duração inteira em horas                |
| 2.3  | Cobrança sobre **hora reservada**, não sobre tempo real              | Gastou menos, paga igual. Sem devolução                           |
| 2.4  | **Pagamento antecipado é catraca**                                   | Reserva não paga **não existe** para o Modelista                  |
| 2.5  | O **pedido declara** as matrizes; cada uma é apontada uma vez         | `pre_order` 1:N `pre_order_item` 1:1 `cut`                        |
| 2.6  | Tempo começa no **manejo do tecido** (plotter/enfesto), não no corte | Um único intervalo por matriz                                     |
| 2.7  | Tempo encerra quando a **máquina de corte desliga**                  | Retirada da esteira é do cliente, não conta                       |
| 2.8  | **Segregação de função** Modelista × Administrativo                  | Ver seção 5. Motivo declarado: evitar caixa dois                  |
| 2.9  | Valor da hora é **de cada máquina**, configurável                    | Cada reserva grava snapshot do preço da máquina                   |
| 2.10 | Horário de funcionamento = **janelas** por dia da semana, N por dia  | Reserva cabe dentro de uma janela; intervalo é ausência de janela |
| 2.11 | "Dia inteiro" = soma das janelas do dia                              | Não existe preço de diária                                        |
| 2.12 | Agenda tem **dois tipos** de compromisso                             | Hora de máquina (faturável) e Atendimento (não)                   |
| 2.13 | Arte/modelagem do cliente **não** fica no sistema                    | Sem storage de arquivos nesta spec                                |
| 2.14 | Cliente novo é cadastrado **só** pelo Administrativo                 | Modelista não cadastra cliente                                    |
| 2.15 | Encaixe de vaga vem **sempre** da fila de espera                     | Nunca antecipando quem já está agendado                           |

---

## 3. Pendências — **NÃO IMPLEMENTAR**

Estes campos existem nos relatórios reais mas ninguém sabe ainda o que significam ou de
onde vêm. **Não crie coluna, não crie campo, não chute o significado.** Serão especificados
depois.

| Item                                                           | Situação                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATRIZ` (número decimal na planilha, ex. 326,43 / 917,62)     | Significado desconhecido                                                                                                                                   |
| "Partes cortadas" (136.442/mês, diferente de "peças cortadas") | Origem do cálculo desconhecida                                                                                                                             |
| Coluna sem título da planilha com "Manual" / "Manual PAGO"     | Significado desconhecido                                                                                                                                   |
| Integração com o relatório do Audaces                          | Adiada. **Será** a fonte dos tempos de corte da máquina (fase 7), que alimentam a separação enfesto × corte do relatório do governo. Não implementar agora |
| Destino do valor pago em caso de não comparecimento            | Depende de contrato; decisão é humana (ver 6.9)                                                                                                            |

---

## 4. Modelo de domínio

Nomes de tabela em `snake_case`, inglês. Todas as tabelas de negócio têm:
`id uuid PK`, `account_id uuid NOT NULL`, `created_at`, `updated_at`.

### 4.1 `account` — o dono da operação (tenant)

| Campo                                               | Tipo          | Regra                             |
| --------------------------------------------------- | ------------- | --------------------------------- |
| `name`                                              | text NOT NULL |                                   |
| `city`                                              | text NOT NULL | aparece no relatório              |
| `report_owner_name` / `_role` / `_phone` / `_email` | text          | responsável pelo relatório mensal |

> **O valor da hora NÃO fica aqui** — é da máquina (ver 4.2). O horário de funcionamento
> também não é par de campos: é uma tabela de janelas (ver 4.1.1).

### 4.1.1 `business_hour` — janelas de funcionamento

Modelada como **janelas abertas**, não como intervalos fechados. Um dia com almoço das 12h
às 13h tem **duas linhas**: 07:00–12:00 e 13:00–19:00. O intervalo é a ausência de janela —
assim não existe conflito possível entre "está aberto" e "está em intervalo", e a quantidade
de intervalos é livre.

| Campo                  | Regra                                |
| ---------------------- | ------------------------------------ |
| `weekday`              | smallint 0–6 (0 = domingo)           |
| `starts_at`, `ends_at` | time NOT NULL, `ends_at > starts_at` |

- N linhas por dia da semana. Dia sem nenhuma linha = fechado.
- Janelas do mesmo dia **não podem se sobrepor** — validar na aplicação e no banco.
- Uma reserva de hora de máquina deve caber **inteiramente dentro de uma única janela**.
  Reserva que atravessa o intervalo do almoço é **erro**, não é aceita partida em duas.
- Reserva de "dia inteiro" = soma das horas das janelas daquele dia (regra 2.11).
- O horário é da **conta**, não da máquina: quem abre e fecha é a operação, e a equipe é
  compartilhada entre as máquinas.

### 4.2 `machine`

| Campo              | Regra                                           |
| ------------------ | ----------------------------------------------- |
| `name`             | text NOT NULL (ex.: "Máquina 01")               |
| `model`            | text nullable (ex.: "Audaces Neocut Bravo")     |
| `hour_price_cents` | int NOT NULL — **o preço da hora é da máquina** |
| `is_active`        | boolean NOT NULL default true                   |

Uma conta pode ter N máquinas, cada uma com seu preço. A agenda é **por máquina**.
Máquina inativa não aceita nova reserva, mas mantém o histórico.

### 4.3 `app_user`

`name`, `email`, `phone` (**PhoneE164 obrigatório** — regra 9 do `CLAUDE.md`),
`password_hash`, `role` ∈ `owner | admin | modelista`, `is_active`.

> **A tabela chama `app_user`, não `user`.** `user` é palavra reservada no PostgreSQL, e o modo
> como ela falha é traiçoeiro: `SELECT * FROM user` no psql **não dá erro** — devolve o usuário da
> conexão. Só funciona entre aspas (`FROM "user"`), e basta um SQL escrito à mão sem elas para uma
> consulta silenciosamente errada passar por revisão. A **classe de domínio continua `User`**: o
> problema é do banco, não do modelo.

**A equipe é a lista de usuários do sistema — não existe "membro da equipe" sem login.**
Não crie tabela de pessoas separada de `app_user`, nem campo de nome livre em lugar nenhum para
representar quem executou algo: toda autoria (`paid_registered_by`, quem apontou a matriz,
quem criou a reserva) referencia `user_id`. Ao adicionar alguém à equipe, o Administrativo
cria o usuário com e-mail, telefone (`PhoneE164`), papel e senha inicial — e o sistema exige
troca de senha no primeiro login. Desligamento é `is_active = false`, **nunca** exclusão:
apagar usuário quebraria a autoria dos registros históricos.

### 4.4 `customer` — a confecção cliente

> A operação é conduzida por uma **associação** (APL), então o cadastro precisa sustentar
> prestação de contas: pessoa jurídica identificada, endereço, e representante legal com CPF.

**Identificação da empresa**

| Campo                | Regra                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| `legal_name`         | text NOT NULL — razão social                                             |
| `trade_name`         | text NOT NULL — nome fantasia (é o que aparece na agenda e no relatório) |
| `document_type`      | enum `cnpj \| cpf` NOT NULL                                              |
| `document`           | Value Object `CNPJ` ou `CPF`, NOT NULL, **único por conta**              |
| `state_registration` | text nullable — inscrição estadual                                       |
| `company_size`       | enum `mei \| me \| epp \| other` nullable                                |
| `employees_count`    | int nullable                                                             |
| `status`             | enum `active \| inactive` NOT NULL default `active`                      |

> `document_type` existe porque facção pequena e costureira autônoma da região podem não ter
> CNPJ. Exigir CNPJ de todos travaria cliente real na porta.

**Endereço**

| Campo                    | Regra                                                     |
| ------------------------ | --------------------------------------------------------- |
| `zip_code`               | text nullable                                             |
| `street`, `number`       | text                                                      |
| `complement`, `district` | text nullable                                             |
| `city`                   | text **NOT NULL** — coluna do relatório mensal do governo |
| `state`                  | char(2) NOT NULL — UF                                     |

**Representante legal** (presidente / sócio / proprietário)

| Campo       | Regra                                                              |
| ----------- | ------------------------------------------------------------------ |
| `rep_name`  | text NOT NULL — é a coluna "EMPRESÁRIO" do relatório do governo    |
| `rep_role`  | enum `president \| partner \| owner \| other` nullable             |
| `rep_cpf`   | Value Object `CPF` NOT NULL — **dado sensível**, ver regras abaixo |
| `rep_phone` | `PhoneE164` NOT NULL — WhatsApp do responsável                     |
| `rep_email` | text NOT NULL                                                      |

**Contato da empresa**

| Campo      | Regra                                             |
| ---------- | ------------------------------------------------- |
| `whatsapp` | `PhoneE164` NOT NULL — canal principal de contato |
| `email`    | text nullable                                     |
| `phone`    | `PhoneE164` nullable — fixo/comercial             |

**Relacionamento com a associação**

| Campo          | Regra                                        |
| -------------- | -------------------------------------------- |
| `is_member`    | boolean NOT NULL default false — é associado |
| `member_since` | date nullable                                |
| `notes`        | text — livre                                 |

**Campos derivados (não persistir como coluna editável)**

- `first_cut_at` — data do primeiro corte concluído. Serve para o relatório mensal contar
  quantas das empresas atendidas no mês eram **novas**. Calcular por query, não por coluna
  mantida à mão.
- Produtos cortados historicamente — derivar de `cut → product_type`, alimenta o campo
  "tipos de produtos cortados" do relatório. **Não** crie um campo de produtos no cliente.

**Regras de tratamento — obrigatórias**

- `rep_cpf` é dado pessoal sensível: **nunca** em log (regra do `CLAUDE.md`), **nunca** em
  DTO de listagem, só no DTO de detalhe e só para `admin`/`owner`.
- O DTO do cliente servido ao papel `modelista` contém apenas `trade_name`, `city`,
  `whatsapp` e `notes`. Sem CPF, sem CNPJ, sem endereço, sem representante — ele não precisa
  e menor privilégio se aplica a dado pessoal do mesmo jeito que a dinheiro.
- `CNPJ` e `CPF` validam dígito verificador no construtor do Value Object
  (`ValidationUtil.isValidCNPJ` / `isValidCPF` do `shared-kernel`).
- Unicidade de `document` é **por conta** (`UNIQUE (account_id, document)`), não global:
  duas contas diferentes podem ter o mesmo cliente.
- Preenchimento de endereço por CEP (ViaCEP ou similar) é **opcional e fora do escopo das
  fases 1–5**. Se implementar depois, vira adapter de saída atrás de um port.

### 4.5 `fabric` — tecido cadastrado

| Campo                 | Regra                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| `name`                | NOT NULL (ex.: Malha, TNT, Jeans, Tricoline)                                |
| `max_layer_height_cm` | numeric NOT NULL — **altura máxima do enfesto inteiro**                     |
| `layer_thickness_cm`  | numeric **nullable** — **espessura de UMA camada**; nulo = ainda não medida |
| `notes`               | particularidade (ex.: "cola se passar de 2,5 cm")                           |

> Este par é o coração da estimativa: a altura máxima limita as camadas, e as camadas
> determinam o tempo. Tecido **não** é texto livre em nenhum lugar do sistema.

**As duas medidas são coisas diferentes — não colapse uma na outra.** A altura máxima é a
restrição **física** (mesa, lâmina, comportamento do material empilhado); a espessura é
propriedade do **material**. Quantas camadas cabem é **consequência das duas**
(`max_layer_height_cm ÷ layer_thickness_cm`), e não substitui nenhuma delas. Não
reinterprete `max_layer_height_cm` como "número máximo de camadas": as duas colunas juntas
descrevem o que a operação faz, e uma só não descreve.

**`layer_thickness_cm` é nullable e continua nullable.** Enquanto o tecido não tiver
espessura cadastrada, o sistema **não avisa nada** sobre altura — silêncio é melhor que
ruído. Não é nulidade transitória à espera de backfill (o caso do `CLAUDE.md`, regra 9): é o
estado legítimo de um cadastro que ninguém mediu ainda. Tornar o campo obrigatório faria o
operador inventar um número para conseguir salvar, e esse número viraria aviso falso em todo
corte do tecido.

### 4.6 `product_type`

`name` (camisa, camiseta, pijama, scrub, maiô, calça, jaleco, avental cirúrgico, macacão…).
Cadastro simples; alimenta o relatório mensal ("tipos de produtos cortados").

### 4.7 `pre_order` — o pedido

| Campo             | Regra                                           |
| ----------------- | ----------------------------------------------- |
| `customer_id`     | FK obrigatória — cliente já cadastrado          |
| `estimated_hours` | int NOT NULL, ≥ 1 — **definido pelo Modelista** |
| `notes`           | recado para o administrativo                    |
| `status`          | enum `open                                      | reserved | discarded` |

**Invariante:** `estimated_hours` só pode ser alterado por usuário de papel `modelista`.
O Administrativo **não edita esse campo** (regra 2.8). As horas são do **pedido inteiro**,
não de cada matriz.

### 4.7.1 `pre_order_item` — as matrizes declaradas

O pedido **declara de antemão** quais matrizes serão cortadas. Cada uma tem o seu tecido e o
seu produto, porque o mesmo cliente traz materiais diferentes na mesma reserva.

| Campo                   | Regra                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `pre_order_id`          | FK                                                          |
| `sequence`              | int — 1, 2, 3… dentro do pedido                             |
| `fabric_id`             | FK obrigatória                                              |
| `product_type_id`       | FK obrigatória                                              |
| `estimated_pieces`      | int — peças que o cliente quer cortar **nesta matriz**      |
| `meters_per_piece`      | numeric nullable                                            |
| `rolls`                 | int nullable                                                |
| `estimated_layers`      | int nullable — estimativa, corrigida no apontamento         |
| `estimated_layout_type` | enum `sheet_by_sheet                                        | zigzag` nullable |

**Um pedido tem no mínimo uma matriz.** Pedido sem matriz não descreve trabalho nenhum e não
pode virar reserva.

> Exemplo real: matriz 1 — tecido X, calça; matriz 2 — tecido Y, camiseta. Duas matrizes, um
> pedido, uma reserva.

### 4.8 `schedule_entry` — compromisso na agenda

Tabela única para os dois tipos, porque ambos ocupam a agenda do Modelista.

| Campo                  | Regra                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `machine_id`           | FK — obrigatória se `type = machine_hour`; nullable se `consultation` |
| `type`                 | enum `machine_hour                                                    | consultation` |
| `starts_at`, `ends_at` | timestamptz                                                           |
| `customer_id`          | FK nullable (consulta pode ser prospect sem pedido)                   |
| `title`                | text — usado em `consultation`                                        |

**Regras de sobreposição (duas regras diferentes — não unifique):**

- `machine_hour` × `machine_hour` na mesma máquina: **proibido**, erro de validação.
  Implementar como constraint no banco além da validação de aplicação:
  ```sql
  ALTER TABLE schedule_entry ADD CONSTRAINT no_machine_overlap
    EXCLUDE USING gist (
      machine_id WITH =,
      tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (type = 'machine_hour');
  -- requer: CREATE EXTENSION IF NOT EXISTS btree_gist;
  ```
  Escrever em SQL na migration — o MikroORM não gera constraint de exclusão.
- `consultation` × qualquer coisa: **permitido**, mas a API retorna aviso
  (`warnings: []` no response) e a UI mostra alerta. O Administrativo decide.

**Renderização de sobreposição na agenda (obrigatório):** quando dois ou mais compromissos
ocupam o mesmo intervalo na mesma máquina, eles são exibidos **um ao lado do outro**, no
padrão de calendário do Teams/Outlook — cada um ocupa uma fração da faixa (1/2 para dois,
1/3 para três). O card reduzido mostra **somente** nome do cliente e horário; todo o resto
(tecido, produto, peças, pagamento, valor, matrizes) fica na **tela de detalhe**, aberta ao
clicar. Não empilhe um sobre o outro nem esconda o de baixo, e não force o card a caber
todas as informações num espaço menor.

**Regras de `machine_hour`:**

- `starts_at` alinhado em hora cheia (minuto e segundo = 0)
- duração inteira em horas, ≥ 1
- inteiramente dentro de **uma única** janela de `business_hour` do dia correspondente
- `consultation` **não** tem essas restrições (pode ser 30 min, fora de hora cheia)

### 4.9 `reservation` — a venda

| Campo                              | Regra                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `schedule_entry_id`                | FK 1:1 com o compromisso `machine_hour`                                |
| `pre_order_id`                     | FK obrigatória                                                         |
| `customer_id`, `machine_id`        | desnormalizados para consulta                                          |
| `hours`                            | int NOT NULL ≥ 1                                                       |
| `hour_price_cents`                 | int NOT NULL — **snapshot** do preço **da máquina** no dia (regra 2.9) |
| `total_cents`                      | int NOT NULL = `hours × hour_price_cents`                              |
| `status`                           | ver seção 4.11                                                         |
| `paid_at`, `paid_registered_by`    | nullable até o pagamento                                               |
| `payment_method`                   | enum `pix \| cash \| transfer` nullable — **só estas três formas**     |
| `no_show_at`, `no_show_resolution` | enum nullable `rescheduled                                             | written_off` |

### 4.10 `cut` — o apontamento de uma matriz declarada

**Uma matriz declarada, um apontamento.** O `cut` não nasce por vontade do Modelista: ele é o
registro de execução de um `pre_order_item` que o pedido já declarou. Não existe apontar
matriz que ninguém pediu, e não existe apontar a mesma duas vezes.

| Campo                          | Regra                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `reservation_id`               | FK                                                                                    |
| `pre_order_item_id`            | FK **única** — a matriz declarada que este apontamento executa                        |
| `marker_name`                  | text nullable — identificação da matriz                                               |
| `started_at`                   | timestamptz — **start**: começou a manejar o tecido (plotter imprimindo, enfesto)     |
| `ended_at`                     | timestamptz nullable — **stop**: máquina de corte desligou                            |
| `machine_cut_started_at`       | timestamptz nullable — **não preencher nesta fase**; reservado para import do Audaces |
| `machine_cut_ended_at`         | timestamptz nullable — idem                                                           |
| `layers`                       | int — camadas confirmadas no stop                                                     |
| `nested_pieces`                | int — peças encaixadas confirmadas no stop                                            |
| `total_pieces`                 | int **derivado** = `layers × nested_pieces`                                           |
| `layout_type`                  | enum `sheet_by_sheet                                                                  | zigzag` |
| `fabric_id`, `product_type_id` | herdados da matriz declarada, editáveis no stop                                       |

> `sequence` saiu: a ordem é a da matriz declarada (`pre_order_item.sequence`). Numerar duas
> vezes a mesma coisa é convidar as duas numerações a divergirem.

**Invariantes:**

- `total_pieces` **nunca** é digitado — sempre calculado. Verificado na planilha real do
  cliente em 9 linhas (ex.: 12 encaixadas × 14 camadas = 168 peças).
- `duration = ended_at − started_at` — **um só tempo por matriz**, do manejo do tecido até a
  máquina desligar.
- **O tempo que vale é o do PEDIDO**, não o da matriz: do primeiro `started_at` ao último
  `ended_at` da reserva. Ele inclui os intervalos entre uma matriz e outra — e inclui de
  propósito, porque esse intervalo aconteceu dentro da hora que o cliente comprou. A duração
  por matriz existe para **métrica**, não para cobrança.
- **Consequência para o histórico por tecido:** o tempo por matriz continua exato, então a
  mediana de minutos por 100 peças continua válida por tecido. O que NÃO se pode fazer é
  somar as matrizes e chamar de tempo do pedido, nem ratear o tempo do pedido entre elas.
- **Não crie botão intermediário** de "começou o corte". A separação enfesto × corte que o
  relatório mensal do governo pede virá do relatório nativo da máquina Audaces, não de toque
  manual — decisão do dono: não vale o trabalho de apontar à mão o que a máquina já mede.
  Os campos `machine_cut_*` existem só para receber esse import na fase 7 e **ficam nulos**
  nas fases 1–5.
- **Aviso de altura:** `layers × fabric.layer_thickness_cm > fabric.max_layer_height_cm` →
  **avisar** (nunca bloquear): quem está na máquina sabe mais que o cadastro. Quando
  `layer_thickness_cm` for **nulo**, **não avise nada** — sem a espessura não há altura a
  calcular, e chutar produz aviso em todo corte.

  > **Correção de erro dimensional.** Uma versão anterior desta linha dizia
  > `layers × fabric.max_layer_height_cm`, o que multiplica uma **contagem** por uma
  > **altura** e não resulta em nada comparável; o código que a seguiu comparava `layers`
  > direto com a altura em cm, e o aviso disparava em praticamente todo corte. Aviso que
  > sempre aparece é aviso que ninguém lê — o efeito prático era perder a proteção inteira.
  > A multiplicação certa é `camadas × espessura_por_camada`, que dá centímetros.
- Só existe `cut` em reserva com `status = confirmed` ou `in_progress`.

### 4.11 Máquina de estados da `reservation`

```
                      ┌──────────────┐
                      │ pre_reserved │  criada pelo Administrativo. Segura o horário.
                      └──────┬───────┘  INVISÍVEL para o Modelista.
              paga           │           liberada p/ fila de espera
        ┌────────────────────┼──────────────────────┐
        ▼                                            ▼
  ┌───────────┐                              ┌────────────┐
  │ confirmed │  aparece na fila do Modelista │  released  │ (terminal)
  └─────┬─────┘                              └────────────┘
        │ 1º start de matriz
        ▼
  ┌─────────────┐      cliente não veio      ┌──────────┐
  │ in_progress │───────────────────────────▶│ no_show  │ pendente de decisão
  └─────┬───────┘                            └────┬─────┘   do Administrativo
        │ Modelista encerra a reserva              │
        ▼                                   rescheduled | written_off
  ┌───────────┐
  │ completed │ (terminal)
  └───────────┘

  cancelled — a partir de pre_reserved ou confirmed, só pelo Administrativo
```

Transições permitidas por papel — ver seção 5. **Nenhuma transição automática por tempo.**
Não existe job que expire pré-reserva: o sistema alerta, a pessoa decide (regra 6.5).

### 4.12 `waiting_list_entry` — fila de espera

Criada e gerida **exclusivamente pelo Administrativo**. O Modelista tem acesso **somente de
leitura**: consulta a lista e aciona o Administrativo quando enxerga vaga, nada além disso.

> O conhecimento técnico não se perde por isso: tecido, horas e particularidade já vêm do
> `pre_order` que o Modelista avaliou. Uma entrada de fila de espera nasce de um pré-pedido
> que não achou vaga — a modelagem entra pelo pré-pedido, não por aqui.

| Campo                                | Regra                                                    |
| ------------------------------------ | -------------------------------------------------------- |
| `customer_id`                        | FK                                                       |
| `pre_order_id`                       | FK nullable — origem, quando veio de pré-pedido avaliado |
| `hours_needed`                       | int NOT NULL                                             |
| `fabric_id`, `product_type_id`       | FK nullable                                              |
| `technical_notes`                    | particularidade do material                              |
| `wants_earlier`                      | boolean — **quer antecipar se vagar**                    |
| `desired_until`                      | date nullable — quer cortar até quando                   |
| `status`                             | enum `waiting                                            | offered | converted | dropped` |
| `offered_at`, `customer_accepted_at` | nullable                                                 |

### 4.13 `bank_account` — conta bancária

| Campo                   | Regra                                            |
| ----------------------- | ------------------------------------------------ |
| `name`                  | text NOT NULL (ex.: "Sicoob — conta da máquina") |
| `bank`                  | text nullable                                    |
| `opening_balance_cents` | int NOT NULL default 0                           |
| `is_active`             | boolean NOT NULL default true                    |

> A operação tem **conta separada** para a máquina. O saldo por conta precisa fechar
> individualmente, então todo lançamento aponta para uma conta.

### 4.14 `financial_category` — categoria de lançamento

`name`, `direction` ∈ `in | out`, `is_active`. Cadastro editável pelo Administrativo.
Sementes iniciais: **entrada** — Hora de máquina, Outras entradas. **Saída** — Insumos,
Salários, Contratos de prestador, Energia, Manutenção, Taxas e tarifas.

### 4.15 `cash_entry` — lançamento de caixa

| Campo                                              | Regra                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `type`                                             | enum `in \| out \| transfer` NOT NULL                                           |
| `occurred_on`                                      | date NOT NULL — **data em que o dinheiro entrou/saiu**                          |
| `amount_cents`                                     | int NOT NULL > 0                                                                |
| `category_id`                                      | FK `financial_category` — obrigatória para `in`/`out`, **nula** para `transfer` |
| `bank_account_id`                                  | FK — conta de origem (`out`/`transfer`) ou destino (`in`)                       |
| `counterpart_account_id`                           | FK nullable — conta destino, **só** em `transfer`                               |
| `description`                                      | text NOT NULL                                                                   |
| `payee`                                            | text nullable — a quem se pagou (fornecedor, colaborador)                       |
| `payment_method`                                   | enum `pix \| cash \| transfer` nullable                                         |
| `reservation_id`                                   | FK nullable — preenchido quando a entrada nasceu de uma reserva                 |
| `created_by`                                       | FK `user` NOT NULL                                                              |
| `cancelled_at`, `cancelled_reason`, `cancelled_by` | nullable                                                                        |

**Invariantes — não flexibilize:**

- **Regime de caixa, não de competência.** O lançamento conta no mês de `occurred_on`.
  Reserva de outubro paga em agosto entra no caixa de **agosto**. Não crie campo de
  competência nem rateio por período.
- **Registrar o pagamento de uma reserva cria o `cash_entry` de entrada automaticamente**,
  com `reservation_id` preenchido, categoria "Hora de máquina" e `amount_cents` igual ao
  `total_cents` da reserva. É um único ato — nunca peça para o Administrativo lançar a
  entrada uma segunda vez à mão, senão o caixa duplica.
- **Remarcação de no-show não gera nova entrada.** O dinheiro já entrou; a nova reserva
  nasce com `paid_at` preenchido e **sem** `cash_entry`. Baixa (`written_off`) também não
  mexe no caixa: a entrada original continua válida.
- **`transfer` entre contas próprias não é receita nem despesa.** Fica fora do DRE — só
  move saldo entre `bank_account_id` e `counterpart_account_id`. Sem isso, mover dinheiro da
  conta da máquina para a conta principal inflaria entradas e saídas do mês.
- **Lançamento não é apagado**, é cancelado com motivo e autor. Saldo e DRE ignoram
  cancelados. Editar valor de lançamento efetivado: proibido — cancele e lance de novo.
- **Isto não é folha de pagamento.** Salário e contrato de prestador são apenas saídas com
  categoria e `payee`. **Não** crie encargo, INSS, FGTS, holerite, competência trabalhista
  nem cálculo de rescisão. O cálculo continua na contabilidade.

### 4.16 DRE de caixa — consulta, não tabela

Não crie tabela de DRE. É uma **query** sobre `cash_entry` no período:

```
entradas  = Σ amount_cents WHERE type='in'  AND cancelled_at IS NULL, agrupado por categoria
saídas    = Σ amount_cents WHERE type='out' AND cancelled_at IS NULL, agrupado por categoria
resultado = entradas − saídas
```

`transfer` **nunca** entra na conta. Saldo de conta bancária =
`opening_balance_cents` + entradas + transferências recebidas − saídas − transferências enviadas.

---

## 5. Papéis e permissões — segregação de função

> **Motivo declarado pelo dono:** se o Modelista pudesse agendar e receber, ele poderia
> operar fora do caixa. "Não está na agenda, não faz." Isso não é preferência de UX; é
> controle interno. **Não relaxe estas regras por conveniência de tela.**

| Ação                                                 | `modelista`     | `admin` | `owner` |
| ---------------------------------------------------- | --------------- | ------- | ------- |
| Cadastrar/editar cliente                             | ❌              | ✅      | ✅      |
| Ver CPF, CNPJ, endereço e representante do cliente   | ❌              | ✅      | ✅      |
| Cadastrar tecido, tipo de produto                    | ✅              | ✅      | ✅      |
| Criar pré-pedido — tecido SEM histórico              | ✅              | ❌      | ✅      |
| Criar pré-pedido — tecido COM histórico              | ✅              | ✅      | ✅      |
| Definir `estimated_hours`                            | ✅              | ❌      | ❌      |
| Criar / mover / cancelar reserva                     | ❌              | ✅      | ✅      |
| Registrar pagamento                                  | ❌              | ✅      | ✅      |
| **Ver qualquer valor em dinheiro**                   | ❌              | ✅      | ✅      |
| Ver reserva `pre_reserved`                           | ❌              | ✅      | ✅      |
| Ver agenda da máquina                                | ✅              | ✅      | ✅      |
| Criar `consultation` na agenda                       | ❌              | ✅      | ✅      |
| Start / corte / stop de matriz                       | ✅              | ❌      | ✅      |
| Marcar "não compareceu"                              | ✅              | ✅      | ✅      |
| Resolver no-show (remarcar/baixar)                   | ❌              | ✅      | ✅      |
| Ver a fila de espera                                 | ✅ (só leitura) | ✅      | ✅      |
| Criar/editar entrada na fila de espera               | ❌              | ✅      | ✅      |
| Oferecer vaga a alguém da fila                       | ❌              | ✅      | ✅      |
| Avisar o Administrativo que vagou horário            | ✅              | —       | ✅      |
| Registrar "cliente aceitou e está vindo"             | ❌              | ✅      | ✅      |
| Ver DRE e lançamentos                                | ❌              | ✅      | ✅      |
| Lançar saída / cancelar lançamento                   | ❌              | ✅      | ✅      |
| Cadastrar conta bancária e categoria                 | ❌              | ✅      | ✅      |
| Configurar janelas de funcionamento                  | ❌              | ❌      | ✅      |
| Cadastrar máquina e definir preço/hora               | ❌              | ❌      | ✅      |
| Criar/editar usuário da equipe (`modelista`/`admin`) | ❌              | ✅      | ✅      |
| Criar usuário de papel `owner`                       | ❌              | ❌      | ✅      |
| Inativar usuário                                     | ❌              | ✅      | ✅      |
| Alterar o **próprio** telefone                       | ✅              | ✅      | ✅      |
| Alterar o telefone **de outro usuário**              | ❌              | ❌      | ✅      |

**Implementação obrigatória:**

- Guards por papel: `ModelistaGuard`, `AdminGuard`, `OwnerGuard` (padrão do `CLAUDE.md`).
- **Os response DTOs servidos ao papel `modelista` não contêm campo monetário nenhum.**
  Não é ocultar no frontend — é não mapear no DTO. `hour_price_cents`, `total_cents`,
  `paid_at`, `payment_method` **ausentes** do DTO do Modelista.
- Endpoints de fila/agenda para o Modelista filtram `status IN ('confirmed','in_progress')`
  no repositório. Uma reserva `pre_reserved` nunca sai da persistência para ele.

---

## 6. Regras de negócio que o agente não pode "melhorar"

**6.1 — A PRIMEIRA estimativa de um tecido é do Modelista.**
O cliente não sabe quanto tempo precisa. Na estreia de um tecido a ordem é: cliente fala
com o Modelista → Modelista cria o pré-pedido com as horas → Administrativo reserva e
cobra.

**A partir do segundo corte daquele tecido, o Administrativo também cria.** A regra
protege a estimativa que só existe na cabeça de quem opera a máquina — e, cumprido o
primeiro corte, ela deixa de ser conhecimento tácito e vira dado: mediana de camadas, de
peças encaixadas e de minutos por 100 peças, tudo registrado pela Fase 5. Nesse ponto o
atendente do Administrativo tem em tela o que precisa para atender um cliente recorrente
sem esperar o Modelista.

A liberação é **condicional, nunca geral**: o backend conta os cortes concluídos com aquele
tecido e recusa o Administrativo quando são zero, com a mensagem explicando que a primeira
estimativa é do Modelista. Não substitua essa contagem por um guard de papel — perderia
exatamente a proteção que a regra existe para dar.

> **Histórico anterior desta regra:** até a entrega em produção ela era absoluta — o
> Administrativo não criava em hipótese nenhuma. Foi relaxada com o critério acima, e a
> forma condicional é parte da decisão, não um detalhe de implementação.

**6.2 — O Modelista nunca cadastra cliente.** Cliente novo entra pelo Administrativo, que
também agenda a primeira conversa como `consultation`. Não crie upload de foto de documento
nem cadastro rápido no app do Modelista.

**6.3 — Pagamento é catraca, inclusive no encaixe de última hora.**
Mesmo quando o cliente da fila de espera é chamado às pressas, a sequência é:
Modelista vê a vaga e **avisa** o Administrativo → o Administrativo escolhe da fila, liga,
cobra e registra pago → **só então** a reserva aparece para o Modelista. O Modelista não
liga para o cliente pelo sistema, não oferece vaga e não registra aceite. Não crie atalho.

**6.4 — Cobra-se a hora reservada.** Terminou em 1h30 numa reserva de 2h: cobra 2h, sem
devolução. Não implemente cálculo proporcional em lugar nenhum.

**6.5 — Não existe expiração automática de pré-reserva.** O sistema mostra quanto falta
para o corte e quantos clientes esperam pela vaga. Liberar o horário é sempre ação humana
do Administrativo. Não crie cron job que cancele reserva.

**6.6 — Sem cliente presente, não se dá start.** O profissional da confecção acompanha o
corte e retira o material. Não desestoca tecido sem ele.

**6.7 — Cliente atrasado corta menos, não paga menos.** O Modelista recalcula quantas peças
cabem no tempo restante e ajusta as camadas/matrizes. O registro conta a história pela
diferença entre `pre_order.estimated_pieces` e a soma de `cut.total_pieces`. **Não crie
campo de "motivo da divergência"** — a decisão foi de manter simples.

**6.8 — Encaixe vem da fila de espera, nunca antecipando agendado.** Quem já está agendado
vai vir no horário dele. Não implemente "puxar reserva futura para agora".

**6.9 — No-show não decide nada sozinho.** Marcar "não compareceu" tira da agenda e cria
pendência para o Administrativo, que escolhe `rescheduled` ou `written_off` conforme
contrato. O sistema não dá crédito automático nem baixa automática.

**6.10 — Consulta na agenda pode sobrepor hora de máquina.** Só avisa. Ver 4.8.

**6.11 — Ninguém inativa o próprio usuário nem o último `owner` ativo da conta.**
As duas travas existem pelo mesmo motivo: uma conta sem ninguém capaz de administrá-la só volta
com acesso ao banco. É o mesmo cenário que a regra 9 do `CLAUDE.md` descreve para senha, aplicado
a papel. **Não remova nenhuma das duas** por não constarem da tabela da §5 — elas constam daqui.

**6.12 — Ninguém redefine a senha de terceiro.** Quem esqueceu usa o código no WhatsApp. Uma senha
escolhida por outra pessoa é uma senha que duas pessoas conhecem, e não existe caminho — nem para
o Administrativo — que troque a senha alheia.

A consequência fecha o cerco: **alterar o telefone de outro usuário equivale a tomar a conta dele**,
porque é para esse número que o código de recuperação vai. Sem isso, a regra teria uma porta dos
fundos de dois passos — mudo o número, peço o código, entro como ele. Portanto:

- **O próprio usuário altera o seu telefone livremente.**
- **Alterar o telefone de outro usuário é exclusivo do `owner`** — nem o `admin` pode.
- Toda alteração de telefone **de terceiro** grava auditoria com **autor, data, número antigo e
  número novo**. É o registro que permite reconstruir um sequestro de conta depois do fato; sem o
  número antigo, a trilha não diz o que mudou.

---

## 7. Fases

### FASE 1 — Fundação, conta e acesso

**Escopo:** app novo em `apps/Kortex/{backend,frontend}` reusando
`packages/domain-primitives` e `packages/shared-kernel`. `account`, `machine`, `user`,
auth JWT própria (login por e-mail + senha), guards por papel, `GlobalExceptionFilter`,
port `ERROR_REPORTER` com adapter no-op, recuperação de senha por código no WhatsApp
(padrão do `CLAUDE.md`), configuração de conta (janelas de funcionamento,
máquinas com preço por hora, dados do responsável pelo relatório) e gestão de usuários da equipe.

**DoD:**

- [ ] Login funcional para os três papéis; `request.user` com `sub`, `role`, `accountId`
- [ ] Rota protegida sem token = 401; papel errado = 403 (teste automatizado)
- [ ] Nenhum repositório consulta sem filtro de `account_id` — script de verificação
- [ ] `.env.example` completo; nenhum secret no código
- [ ] Migration SQL versionada em `deploy/sql/` ou MikroORM, com `btree_gist` criada

### FASE 2 — Cadastros

**Escopo:** `customer` (com `owner_name` e `city` obrigatórios), `fabric` (com
`max_layer_height_cm`), `product_type`, CRUD completo no painel web.

**DoD:**

- [ ] Cliente exige razão social, nome fantasia, documento, cidade/UF, representante legal
      (nome, CPF, WhatsApp, e-mail) e WhatsApp da empresa
- [ ] `CNPJ` e `CPF` são Value Objects que validam dígito verificador; documento inválido = 400
- [ ] `UNIQUE (account_id, document)` — documento repetido na mesma conta = erro tratado
- [ ] DTO de **listagem** de clientes não contém CPF (teste explícito de ausência de campo)
- [ ] DTO de cliente para o papel `modelista` contém só nome fantasia, cidade, WhatsApp e
      observações (teste explícito de ausência dos demais campos)
- [ ] Nenhum log contém CPF, CNPJ ou endereço — inclusive em log de erro
- [ ] Tecido exige altura máxima de enfesto
- [ ] Modelista consegue cadastrar tecido e tipo de produto, **não** consegue cadastrar cliente (403)
- [ ] Todos os DTOs de request com `class-validator` em todos os campos

### FASE 3 — Pré-pedido e fila de espera

**Escopo:** `pre_order` criado pelo Modelista no app mobile; `waiting_list_entry` criada
pelo Administrativo (podendo nascer de um pré-pedido sem vaga), com `wants_earlier`;
leitura da fila de espera no app do Modelista; ação "avisar administrativo".

**DoD:**

- [ ] Administrativo recebe pré-pedido com horas já definidas e **não consegue** editar `estimated_hours` (403)
- [ ] Fila de espera mostra `wants_earlier` de forma destacada
- [ ] Modelista **lê** a fila de espera e recebe 403 ao tentar criar, editar ou oferecer vaga
- [ ] Modelista consegue avisar o Administrativo de horário vago (aviso, não agendamento)
- [ ] App mobile do Modelista: criar pré-pedido em uma tela, sem digitar cliente novo

### FASE 4 — Agenda, reserva e pagamento

**Escopo:** `schedule_entry` com os dois tipos, `reservation`, gate de pagamento,
liberação para fila de espera, no-show e sua resolução. Agenda web em grade
horas × dias por máquina. Agenda mobile (leitura) para o Modelista.

**DoD:**

- [ ] Duas `machine_hour` sobrepostas na mesma máquina = erro (testado no banco, não só na app)
- [ ] `consultation` sobreposta = criada com `warnings` no response
- [ ] Compromissos sobrepostos renderizam lado a lado, dividindo a faixa, com card reduzido
      (nome + horário) e detalhe ao clicar
- [ ] Reserva fora de janela de funcionamento = erro
- [ ] Reserva que atravessa intervalo (ex.: 11→14 com almoço 12–13) = erro
- [ ] Preço vem da **máquina** escolhida; máquinas com preços diferentes geram valores diferentes
- [ ] Reserva com minuto ≠ 0 ou duração fracionada = erro
- [ ] `hour_price_cents` gravado na reserva; alterar o preço da máquina **não** altera reserva existente
- [ ] Endpoint da fila do Modelista **nunca** retorna `pre_reserved` (teste explícito)
- [ ] DTO do Modelista sem nenhum campo monetário (teste explícito de ausência de campo)
- [ ] No-show cria pendência; resolução só por `admin`/`owner`

### FASE 5 — Apontamento e histórico

**Escopo:** `cut` com dois toques (start no manejo do tecido → stop quando a máquina
desliga), N matrizes por reserva, confirmação de camadas/peças encaixadas/tipo de enfesto no stop, `total_pieces`
derivado. Histórico por tecido: dado o tecido e o volume, mostrar camadas, peças e duração
dos cortes anteriores — consumido na tela de pré-pedido (fase 3) como parâmetro.

**DoD:**

- [ ] `total_pieces` calculado, nunca aceito do cliente HTTP
- [ ] Matriz medida com **dois toques** (start/stop) — nenhum botão de "começou o corte"
- [ ] Camadas acima da altura máxima do tecido = aviso, **não** bloqueio
- [ ] Reserva `pre_reserved` não aceita start (403/400)
- [ ] Tela de matriz mostra corrido e restante ao mesmo tempo; passado o fim da reserva, o
      restante vira excedente contando para cima, sem travar nem interromper nada
- [ ] Após `completed`, matriz não é mais editável pelo Modelista
- [ ] Histórico por tecido responde em < 300 ms com 5.000 cortes semeados

---

## 8. Frontend — duas superfícies, um app Next.js

- **`/m/*` — app do Modelista.** Mobile-first, instalável como **PWA** (manifest +
  service worker). Alvo de toque ≥ 56 px, uma decisão por tela, nenhuma digitação além de
  números. Telas: fila do dia, avaliar/criar pré-pedido (declarando as matrizes), agenda
  (leitura), matrizes da reserva com os dois toques, fila de espera (leitura).
- **`/*` — painel do Administrativo.** Desktop. Agenda em grade horas × dias, cadastros,
  reserva, pagamento, fila de espera, pendências (pagamento em risco, confirmar amanhã,
  no-show a resolver).
- Roteamento por papel no login: `modelista` cai em `/m`, `admin`/`owner` no painel.
- Referência visual: **`kortex_prototipo_modelista.html`** e **`kortex_prototipo_admin.html`**
  (tokens de cor, tipografia e composição — os dois compartilham o mesmo `:root`). **Siga os
  protótipos**; onde eles divergirem desta spec, a spec vence.
  Os arquivos `corte_tecido_mockups*.html` estão **obsoletos** — ignore-os.

**Offline no app do Modelista:** start e stop precisam funcionar com rede instável. Grave
a ação em fila local (IndexedDB) com timestamp do dispositivo e sincronize quando voltar.
O timestamp que vale é o do momento da ação, não o da sincronização.

**A tela de matrizes é dirigida pelo PEDIDO.** Ela lista as matrizes que o pedido declarou
(§4.7.1) — apontadas ou não — e não existe botão para criar matriz. Cada matriz declarada
rende exatamente um apontamento; quando todas foram apontadas, o lugar de acrescentar
trabalho é o pedido, não o cronômetro.

**Cronômetros da tela de matriz — os três, simultâneos:**

| Relógio                | Base                                               | Comportamento                                                       |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| **Total do pedido**    | primeiro `started_at` → último `ended_at` (ou agora) | Sobe. É o número em **destaque** — é o que vale no fim              |
| **Matriz atual**       | `now − cut.started_at` da matriz em andamento      | Sobe. Secundário: alimenta a métrica por tecido, não a cobrança      |
| **Restante**           | `reservation.ends_at − now` da **reserva inteira** | Desce. Secundário                                                    |

- O **total do pedido** é o número em destaque porque é o que importa no fim: ele inclui os
  intervalos entre uma matriz e outra, e esses intervalos aconteceram dentro do bloco de
  máquina que o cliente comprou. **Não é a soma das matrizes** — somá-las deixaria os
  intervalos de fora.
- O tempo **por matriz** continua exato e continua sendo gravado: é dele que sai a mediana de
  minutos por 100 peças por tecido. Serve a **métrica**, não a cobrança.
- O restante é da **reserva**, não da matriz: é com ele que o Modelista decide se cabe mais
  uma matriz antes de acabar a hora comprada.
- Quando o restante chega a zero, ele **não zera nem some** — vira **excedente** e passa a
  contar para cima, com sinal e em cor de alerta (`+00:18:42`). A barra de horas passa do
  fim e ganha faixa de excedente.
- Os outros dois continuam subindo normalmente durante o excedente. Nada trava, nada
  interrompe, nenhum aviso bloqueante.
- O excedente é **só informação**: não altera cobrança (regra 6.4), não gera pendência
  financeira nesta fase. Serve ao histórico, para a próxima estimativa sair melhor.
- Os três relógios usam `font-variant-numeric: tabular-nums`, senão o número treme a cada
  segundo.

### FASE 6 — Financeiro de caixa e mini DRE

**Escopo:** `bank_account`, `financial_category`, `cash_entry`. Entrada automática ao
registrar pagamento de reserva. Saídas manuais (insumos, salários, contratos, energia,
manutenção, tarifas). Transferência entre contas próprias. Extrato por conta e por período.
DRE de caixa mensal por categoria, com resultado. Cancelamento de lançamento com motivo.

**DoD:**

- [ ] Registrar pagamento de reserva cria **exatamente um** `cash_entry` de entrada (teste
      de não-duplicação)
- [ ] Remarcação de no-show **não** cria segunda entrada (teste explícito)
- [ ] `transfer` não aparece em entradas nem em saídas do DRE, mas altera saldo das duas contas
- [ ] Lançamento cancelado sai do saldo e do DRE, mas continua consultável com motivo e autor
- [ ] Tentativa de editar valor de lançamento efetivado = erro
- [ ] DRE de um mês fecha: entradas − saídas = resultado, e a soma dos saldos das contas
      bate com saldo inicial + movimentação
- [ ] Nenhum campo de encargo trabalhista existe no schema
- [ ] Modelista recebe 403 em todos os endpoints financeiros

---

## 9. Repositório e caminhos

| Item                   | Valor                                                           |
| ---------------------- | --------------------------------------------------------------- |
| Monorepo local         | `C:\HD\Eliab\Veertex`                                           |
| App                    | `apps/Kortex/{backend,frontend}`                                |
| Pacotes compartilhados | `packages/domain-primitives`, `packages/shared-kernel`          |
| Repositório remoto     | GitLab, projeto **próprio**: `git@gitlab.com:eliab1/kortex.git` |
| Namespace npm          | `@gitspread/*` (legado do template — apenas namespace)          |

### ⚠️ Conflito a resolver antes do primeiro push

O app vive **dentro** do monorepo e depende de `packages/domain-primitives` e
`packages/shared-kernel`, mas o repositório remoto é **só do Kortex**. Isso quebra o deploy
do jeito que está: o playbook do `CLAUDE.md` exige **Docker Context Path = `/`** (raiz do
repo) porque o Dockerfile copia os `packages/`. Se o repo `kortex` contiver apenas
`apps/Kortex`, o build falha com `COPY ... not found` — o mesmo erro já documentado no
playbook do mdantas.

Três saídas possíveis, **nenhuma decidida ainda** — perguntar ao Eliab antes de configurar
o remote:

1. **Repo espelha um recorte do monorepo** — o repositório `kortex` tem na raiz
   `packages/` + `apps/Kortex/` + `package.json` do workspace. Deploy funciona sem mudança.
   Custo: sincronizar dois lugares (`git subtree push` a partir do monorepo).
2. **Publicar os pacotes no GitLab Package Registry** — `@gitspread/domain-primitives` e
   `@gitspread/shared-kernel` viram dependência versionada. Repo do Kortex fica limpo.
   Custo: passo de release a cada mudança em pacote compartilhado.
3. **Vendorizar** — copiar os pacotes para dentro do Kortex. Mais simples hoje, e o pior a
   médio prazo: as cópias divergem e a consistência entre sistemas se perde, que é
   justamente o motivo de existir o monorepo.

**Não escolha sozinho.** Até a decisão, trabalhe no monorepo local normalmente e não
configure o remote.

### Deploy (quando chegar a hora)

Segue o playbook "Deploy no Servidor mdantas (Dokploy)" do `CLAUDE.md`: provedor **Git +
Deploy Key** (não OAuth), base `node:22-alpine`, `package-lock.json` versionado,
`.dockerignore` na raiz, backend com domínio em `/api` e Strip Path OFF, frontend com API
base relativa `/api`, DNS na Cloudflare com nuvem **cinza**. Perguntar em qual project do
Dokploy o Kortex entra e qual subdomínio.

---

## 10. Ordem de trabalho sugerida por fase

1. Migration SQL primeiro (schema é contrato)
2. Domain: entidades, Value Objects, exceções
3. Application: ports, use cases, DTOs
4. Infrastructure: ORM entities, mappers, repositories, controllers, guards
5. Testes: unit no domínio, integração nos repositórios, e2e nos fluxos de permissão
6. Frontend
7. Preencher o DoD e **parar**
