# Kortex — histórico da construção com a IA

> Registro da sessão de desenvolvimento do Kortex, de **14/08/2026 a 25/08/2026**.
> Escrito antes de formatar a máquina, para o que foi decidido não morrer junto com o disco.
>
> A transcrição completa desta e das outras sessões está em
> [`docs/historico-ia/`](../../docs/historico-ia/) na raiz do monorepo.
> O arquivo desta sessão é `2026-08-14-be23e9cb.md`.

---

## 1. O que é o Kortex

Sistema de **venda de hora-máquina** para uma operação de corte robotizado de tecido —
o polo de corte em Ceres (GO), conta `Corte Ceres · APL`. O cliente compra um bloco de horas
da máquina de corte Audaces; o sistema organiza quem entra, quando, quanto paga e quanto
tempo de fato usou.

**Três papéis, com separação de função deliberada:**

| Papel | O que faz | O que **não** faz |
| --- | --- | --- |
| **Modelista** | Avalia o material, define as horas, aponta o corte na máquina | Não vê dinheiro, não cadastra cliente, não reserva |
| **Administrativo** | Cadastra cliente, reserva, cobra, registra pagamento, lança financeiro | **Não aponta corte** e **não altera as horas** do pedido |
| **Dono (owner)** | Passa pelos dois lados | Também **não** altera as horas — nem ele |

A separação não é burocracia: se o Administrativo pudesse vender e executar, fecharia o ciclo
sozinho. E as horas são a avaliação técnica de quem está na máquina — quem recebe esse número
pronto não o discute.

**Onde vive:** `apps/Kortex/{backend,frontend}` dentro do monorepo `C:\HD\Eliab\Veertex`.
**Documento que rege tudo:** `apps/Kortex/Requisitos/SPEC_CORTE_FASES_1_A_5.md` (cobre as Fases 1 a 6).
**Protótipos visuais:** `kortex_prototipo_admin.html`, `kortex_prototipo_modelista.html`, `kortex_login.html`.

**Stack:** NestJS 10 + Fastify + MikroORM 6 + PostgreSQL 17 · Next.js 14 (App Router) + MUI 5 ·
JWT próprio · recuperação de senha por código no WhatsApp (Evolution API).

---

## 2. Linha do tempo — o que foi construído

| Commit | Data | Entrega |
| --- | --- | --- |
| `4c7eaba` | 17/08 | **Fase 1** — fundação, conta, usuários e acesso |
| `293a718` | 17/08 | **Fase 2** — cadastros de cliente, tecido e tipo de produto |
| `048ae83` | 17/08 | **Fase 3** — pré-pedido e fila de espera |
| `fa64e7b` | 17/08 | **Fase 4** — agenda, reserva e pagamento |
| `d449527` | 17/08 | **Fase 5** — apontamento da matriz e histórico por tecido |
| `d9a0765` | 17/08 | **Fase 6** — financeiro de caixa e mini DRE |
| `bd73b26` | 17/08 | Correção do erro dimensional do aviso de enfesto |
| `8fd226c` | 18/08 | Fuso na conta + artefatos de deploy para `kortex.ind.br` |
| `ab66180` | 18/08 | Espelho encadeia no histórico remoto em vez de forçar push |
| `d94ba0b` | 18/08 | Tela de acesso com a mesa de corte animada |
| `68581d7` | 19/08 | Máscara de documento, contador de pré-pedidos, pedido no extrato |
| `b14cea5` | 19/08 | Mover a agenda, engrenagem de configuração, cronômetro que não some |
| `30f23cc` | 19/08 | Botões de mover e editar na agenda |
| `ee0128a` | 19/08 | Reset de senha por CLI, Pedidos antes da Agenda, rótulos |
| `857d2b9` | 20/08 | Administrativo abre pedido de tecido com histórico (regra 6.1) |
| `82da039` | 20/08 | Balões de pendência, sino de avisos, correções da agenda |
| `9697ace` | 21/08 | **O pedido declara as matrizes**, e cada uma é apontada uma vez |

Fase 7 (Relatório de Atividades) está **parada por dependência externa** — pendências do
Cristiano. Não foi iniciada de propósito.

---

## 3. As decisões que valem mais que o código

Estas são as escolhas que, se esquecidas, fariam alguém "consertar" o sistema de volta para
o errado. Cada uma tem o motivo junto, porque decisão sem motivo é revertida na primeira
pressa.

### 3.1 O pedido declara as matrizes (a remodelagem de 21/08)

**Como era:** o pedido tinha UM tecido e UM produto, e o Modelista abria quantos apontamentos
quisesse na reserva, numerados pelo próprio cronômetro.

**Por que estava errado:** não é o que a operação faz. O cliente chega com materiais diferentes
na mesma reserva — matriz 1 tecido X calça, matriz 2 tecido Y camiseta. Isso pertence ao pedido,
não a uma decisão improvisada ao lado da máquina.

**Como ficou:** `pre_order` 1:N `pre_order_item` 1:1 `cut`. A quantidade de contagens é a que o
pedido declara. Pedido de uma matriz tem uma contagem; a segunda tentativa é recusada com a
mensagem que diz onde corrigir — *no pedido*. A garantia é **índice único no banco**
(`cut_one_per_pre_order_item`), não só regra de aplicação.

> Sua frase, que virou a regra: *"pode fazer por matriz, que tem mais lógica, mas só pode
> aplicar a quantidade de matriz que tem no pedido, se tiver só 1, então, só terá uma contagem."*

### 3.2 O tempo que vale é o do pedido, não o da matriz

Do **primeiro start ao último stop**, com os intervalos entre matrizes incluídos — eles
aconteceram dentro do bloco de máquina que o cliente comprou. **Somar as matrizes daria um
número menor** que o tempo realmente ocupado.

O tempo por matriz continua exato e continua gravado: é dele que sai a mediana de minutos por
100 peças por tecido. Serve à **métrica**, não à cobrança.

> *"tem que contar o tempo total do pedido, pq no final, o que vale é esse tempo total, o
> histórico do tempo da matriz, só vai servir para métricas."*

### 3.3 Dois toques, um tempo só — e nunca um terceiro botão

`start` quando começa o manejo do tecido (plotter imprimindo, enfesto começando) e `stop`
quando a máquina de corte desliga. **Não existe** botão intermediário de "começou o corte".

A separação enfesto × corte que o relatório mensal do governo pede virá do **relatório nativo
do Audaces** na Fase 7 — decisão do dono: não vale apontar à mão o que a máquina já mede. Os
campos `machine_cut_started_at` / `machine_cut_ended_at` existem só para receber esse import e
**ficam nulos** nas fases 1–6.

A retirada do material da esteira é do cliente e **não conta**: o tempo encerra quando a
máquina desliga.

### 3.4 `total_pieces` nunca é digitado

É sempre `layers × nested_pieces`. Verificado na planilha real do cliente em nove linhas
(ex.: 12 encaixadas × 14 camadas = 168 peças). **Não há campo no DTO de request por onde o
cliente HTTP o informe** — e a ausência é a regra, não um esquecimento.

### 3.5 O erro dimensional do aviso de enfesto

A spec dizia `layers × fabric.max_layer_height_cm`, o que multiplica uma **contagem** por uma
**altura** e não resulta em nada comparável. O código que a seguiu comparava `layers` direto
com a altura em cm — e o aviso disparava em praticamente **todo** corte.

> Aviso que sempre aparece é aviso que ninguém lê. O efeito prático era perder a proteção inteira.

**Correção:** criada a coluna `fabric.layer_thickness_cm` (nullable). A comparação passou a ser
`layers × layer_thickness_cm > max_layer_height_cm`, que dá centímetros dos dois lados.
Quando a espessura é **nula, não avisa nada** — sem ela não há altura a calcular, e chutar
produz exatamente o ruído que se está corrigindo.

E é **aviso, nunca bloqueio**: quem está na máquina sabe mais que o cadastro. O cadastro é a
estimativa; a máquina é o fato.

### 3.6 A regra 6.1 — quem pode abrir pedido

A primeira estimativa de um tecido é conhecimento de quem está na máquina, e só existe na
cabeça dele. Da segunda em diante, está no sistema.

Então: o **Modelista** cria pedido sempre. O **Administrativo** cria **só para tecido com corte
concluído** — e a tela mostra a mediana medida ao lado do campo de horas, para ele confirmar um
número em vez de digitar um palpite.

Com a remodelagem de matrizes, a regra passou a valer **por matriz**: basta um tecido estreante
para o pedido ser recusado. Verificar só a primeira deixaria o segundo material entrar sem
estimativa que o sustente.

> Sua correção que destravou isso: *"sim, mas em uma segunda vez, que já se sabe do histórico,
> o atendente do adm pode sim ter conhecimento e poder fazer."*

### 3.7 A catraca do pagamento (regra 2.4)

Reserva não paga **não existe** para o Modelista. `start` numa pré-reserva devolve 403 —
seria cortar tecido de um serviço que ninguém comprou.

Por isso o botão "Liberar para a fila" foi **removido** da agenda: a liberação se dá com o
recebimento (pix, dinheiro ou transferência), não com um clique.

### 3.8 Remarcação de no-show mantém as horas pagas

Mensagem, na sua redação:

> *"A remarcação mantém as {n}h já pagas. Se o cliente precisa de mais tempo, remarque estas
> horas e crie uma reserva separada para o restante."*

E a remarcação **não** cria segunda entrada no caixa — tem teste explícito para isso.

### 3.9 Excedente é informação, não cobrança

Quando o restante da reserva chega a zero, ele **não zera nem some**: vira excedente, ganha
sinal (`+00:18:42`) e cor de alerta, e conta para cima. Nada trava, nada interrompe, nenhum
aviso bloqueante. Cobra-se a hora reservada. O excedente serve ao histórico, para a próxima
estimativa sair melhor.

### 3.10 Três relógios na tela do Modelista

| Relógio | Base | Papel |
| --- | --- | --- |
| **Total do pedido** | primeiro start → último stop | Número em destaque — é o que vale |
| **Matriz atual** | `now − cut.started_at` | Secundário, alimenta a métrica |
| **Restante** | `reservation.ends_at − now` | Desce; é com ele que se decide se cabe mais uma matriz |

Todos com `font-variant-numeric: tabular-nums`, senão o número treme a cada segundo.

### 3.11 DRE é agregação, nunca tabela

O mini DRE de caixa é calculado por consulta agregada sobre `cash_entry`. Não existe tabela de
DRE. Regime de **caixa**: o pagamento entra na data em que foi registrado.
`transfer` entre contas próprias não aparece em entradas nem em saídas, mas altera o saldo das
duas. Lançamento cancelado sai do saldo e do DRE, mas continua consultável com motivo e autor.

### 3.12 Toda entidade que faz login tem WhatsApp obrigatório

Porque a recuperação de senha é **código de 6 dígitos no WhatsApp**, não link por e-mail.
Usuário sem número é usuário que perde a conta no primeiro esquecimento — e o suporte só
devolve com acesso ao banco.

---

## 4. Decisões de arquitetura que custaram caro para descobrir

### 4.1 Ciclos de módulo resolvidos na camada de persistência

Aconteceu duas vezes. A solução foi a mesma: **read model no adapter**, não import cruzado
entre contextos.

- `finance` → `schedule`: `reservationRefs` resolve a referência da reserva por SQL no
  repositório de finanças.
- `pre-order` → `cut`: `CutHistoryPort` + `MikroOrmCutHistoryRepository` dão ao pré-pedido o
  histórico do tecido sem o contexto de pedido conhecer o de corte.

### 4.2 Filtro de conta sempre inline na consulta

O `accountId` vai **dentro** da chamada do `find`/`findOne`/`count`, nunca montado antes numa
variável. Dois motivos, e nenhum é estilo: quem revisa vê a conta na própria linha, e o
verificador `check:tenant-scope` lê o argumento da chamada.

Descoberto na prática: uma consulta com filtro em variável passava despercebida na revisão
**e** derrubava o verificador.

### 4.3 O ponto cego do verificador

`array.find((x) => ...)` tem o mesmo nome do `find` do MikroORM, e um repositório usa os dois.
O verificador acusava código correto.

> Ferramenta de segurança que aponta o dedo para código correto treina quem lê a ignorá-la.

Corrigido: o verificador pula quando o primeiro argumento é um callback — o MikroORM **nunca**
recebe callback como primeiro argumento, ele recebe o objeto de filtro.

### 4.4 Invariantes no banco, não só na aplicação

- `cash_entry_one_per_reservation` — índice único parcial: um pagamento, um lançamento
- `cut_one_per_pre_order_item` — um apontamento por matriz declarada
- `no_machine_overlap` — `EXCLUDE USING gist` com `btree_gist`: duas horas-máquina não se
  sobrepõem na mesma máquina

### 4.5 A migration que quase quebrou em produção

A remodelagem de matrizes precisou parear cortes antigos com matrizes novas. A versão inicial
casava por **tecido e produto** — e dois cortes do mesmo pedido no mesmo material apontariam
para a mesma matriz, violando o índice único no meio da migration.

Corrigido para parear por `row_number()` sobre a mesma ordenação usada para criar os itens.
**Validada nos dois sentidos** contra um banco com dados no formato antigo, incluindo esse caso.

E foi removido o `delete from cut where pre_order_item_id is null`:

> Se sobrar corte sem matriz, o certo é a migration abortar e alguém olhar. Apagar apontamento
> em silêncio para uma migration passar é perder tempo de máquina já cobrado do cliente.

---

## 5. Deploy — o que funcionou e o que deu trabalho

### 5.1 A §9 resolvida: recorte espelhado

O app vive dentro do monorepo e depende de `packages/`, mas o repositório remoto é só do Kortex.
A saída escolhida: **espelho** em `git@gitlab.com:eliab1/kortex.git` contendo `packages/`,
`apps/Kortex/` e o `package.json` de workspace.

Publicado por `apps/Kortex/deploy/publish-mirror.sh`, que **encadeia no histórico remoto** em
vez de forçar push — o GitLab protege a branch `main`, e a resposta certa a isso não era
enfraquecer a proteção.

### 5.2 Infra

- **Domínio:** `kortex.ind.br` · **Dokploy** em `dokploy.mdantas.com.br` · **IP** `72.61.43.90`
- **Banco:** PostgreSQL 17 em container no Dokploy (não Supabase) · sem Redis · sem storage
- Dockerfiles monorepo-aware, **context path `/`**, base `node:22-alpine`, usuário não-root,
  healthcheck em `127.0.0.1`
- Frontend com **API relativa `/api`** no mesmo domínio — evita embutir URL no build

### 5.3 Os erros que custaram tempo (e não devem se repetir)

| Sintoma | Causa | Correção |
| --- | --- | --- |
| `COPY ... not found` | Docker Context Path apontando para a pasta do Dockerfile | Context Path = `/` (raiz do repo) |
| `Module not found: react-hook-form` | npm **aninha** pacotes com conflito de versão; um estágio `deps` separado os perdia | `npm ci` dentro do estágio de build |
| `next build` falhando no Prettier | Config do ESLint vive na raiz do repo, ausente na imagem | `eslint: { ignoreDuringBuilds: true }`, mantendo o type check |
| Página sem CSS | `output: standalone` preserva a estrutura do monorepo dentro de si | `WORKDIR /repo` e caminhos corrigidos |
| Espelho vazio | `package-lock.json` nunca commitado com os workspaces do Kortex | Corrigido em `3e9b638` — o guard de árvore suja do script pegou |
| Push rejeitado | Branch `main` protegida no GitLab | Script reescrito para encadear e dar push fast-forward |
| `getaddrinfo ENOTFOUND` | `DATABASE_URL` com placeholder não substituído | Internal Host real do Postgres do Dokploy |
| `@` na senha do banco | Quebra a string de conexão | Percent-encode (`%40`) |
| Certificado `TRAEFIK DEFAULT CERT` | Let's Encrypt não emitiu | **Pendente** — ver §6 |

### 5.4 Operação

- `npm run migration:deploy` → `run-migrations.ts` (migrations em passo separado, não no boot)
- `create-account.ts` → cria conta + primeiro dono, com `must_change_password = true`
- `password:reset` → reset de senha por CLI, criado depois de o dono ficar sem acesso

Toda senha definida por operador nasce com `must_change_password = true`.

---

## 6. O que ficou pendente

1. **Certificado TLS de `kortex.ind.br`** — ainda `TRAEFIK DEFAULT CERT`. DNS e porta 80
   verificados corretos; a suspeita é e-mail do Let's Encrypt ausente na configuração do
   Dokploy. **Não resolvido.**
2. **Evolution API** — configurado por você no Environment do backend, mas ainda **não provado
   por uma linha de log**. Vale um teste de recuperação de senha ponta a ponta.
3. **Fase 7 — Relatório de Atividades** — travada nas pendências externas (Cristiano). Depende
   do import do relatório nativo do Audaces para separar enfesto de corte.
4. **Botão "Desistir e oferecer à fila de espera"** — o botão de liberar foi removido da agenda;
   ofereci recriá-lo com esse nome e propósito, você não pediu. Fica registrado como ideia.

---

## 7. Como eu devo trabalhar neste projeto

Regras que você estabeleceu e que valem para qualquer sessão futura:

- **Conversa em português (pt-BR)**; identificadores e nomes técnicos em inglês; textos de tela
  em português; comentários em português.
- **Nunca inventar campo, regra ou tela** que a spec não pede — e nunca "melhorar" as regras das
  seções 2 e 6 por conta própria. Diante de ambiguidade: parar e perguntar.
- **Segredo nunca vai para o chat, para o código ou para o repositório.** Recusei gerar segredos
  JWT e hashes bcrypt na conversa porque o transcript é um canal registrado — e você aceitou.
- **Evolution API:** usar a apikey **da instância**, nunca a chave global.
- **Não configurar o remote por conta própria**; publicação só pelo `publish-mirror.sh`.
- Commit local não depende de deploy; push depende.
- Quando um teste falha, dizer que falhou, com a saída. Quando um passo foi pulado, dizer que
  foi pulado.

Uma lição minha, registrada porque atrapalhou o trabalho: eu disparei builds e testes em
paralelo para acompanhar o progresso e deixei cerca de 25 processos node órfãos, até o daemon
do Docker cair. Um comando de cada vez quando o recurso é a máquina inteira.

---

## 8. Estado na data deste registro (25/08/2026)

- **Backend:** 210 testes unitários + 230 e2e passando · lint limpo · `check:tenant-scope` verde
- **Frontend:** build de produção limpo
- **Último commit do Kortex:** `9697ace` — a remodelagem de matrizes
- **Publicado no espelho** e pronto para Deploy no Dokploy
- A migration `Migration20260820140000` **ainda não rodou em produção**. Ela reorganiza pedidos
  e cortes existentes; se falhar, o backend não sobe — que é o comportamento certo. Vale olhar
  o log da primeira subida.
