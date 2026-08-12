# VEERTEX — Frontend F1/F2 · Especificação de desenvolvimento

> **Base:** protótipo `Veertex CORE Proposta Frontend` (navegação contextual),
> `00_Veertex_Visao_Geral.md`, `01_Veertex_Core.md`, `ADR-0001`.
> **Stack real:** Next.js 14 (App Router) · React 18 · TypeScript · **Material-UI 5** (Emotion).
> Backend NestJS sob `/api`. Dev: front `3021`, back `3020`.
>
> **Correção de 12/08/2026 (Eliab).** A versão anterior deste cabeçalho dizia "Next.js 15 · React 19
> · Tailwind v4 · shadcn/ui", que era a stack do PROTÓTIPO, não a do repositório. Decidido:
> implementar o desenho em MUI — a especificação é sobre **desenho e comportamento**, e migrar de
> stack não entrega funcionalidade nenhuma; gastaria uma fatia que a Mesa, os Papéis, os Módulos e o
> endpoint de intenção precisam. O `CLAUDE.md` também manda MUI para todo elemento de UI.
> **Regra da casa:** requisito ausente vira pergunta, nunca default silencioso.

---

## 1. Escopo — o que é construível hoje

O protótipo mostra seis telas. Três têm backend; três não.

| Tela do protótipo | Backend | Nesta fase |
|---|---|---|
| **Mesa** (superfície de intenção) | ⚠️ falta o endpoint de intenção (§2) | **construir** |
| **Papéis** (frase → permissões) | ✅ F1 — papéis, permissões granulares | **construir** |
| **Módulos** (toggle + dependências) | ✅ F2 — catálogo, ativação, guard | **construir** |
| Empresas / Usuários / Auth | ✅ F1 | **revestir** com a nova casca |
| Contato | ❌ especificado, não implementado | fora |
| Produto | ❌ especificado, não implementado | fora |
| Dashboard | ❌ não implementado | fora |

**Não construa Contato, Produto e Dashboard.** Eles chegam junto com suas fatias de
backend. Construir a tela antes é criar formulário contra contrato inexistente — e o
formulário de produto depende de `field_config`, que também não existe.

O que esta fase entrega: **a casca por intenção funcionando de ponta a ponta em dois
domínios reais** (papéis e módulos). É o suficiente para provar a tese e para as fatias
seguintes só acrescentarem comandos.

## 2. Pré-requisito de backend: o endpoint de intenção

**Não existe hoje.** Precisa nascer antes da Mesa, em fatia própria.

### Fronteiras (inegociáveis)

- **LLM só traduz.** Entrada: texto ou transcrição. Saída: **um JSON de comando
  validado por schema**. Campo desconhecido vem `null` + `needs_confirmation`. Nunca
  prosa livre, nunca SQL, nunca cálculo, nunca decisão de autorização.
- **Backend decide tudo.** Valida o comando contra plano ∩ conta ∩ papel, dependências
  de módulo e regras da entidade. Monta o rascunho. Todo número exibido é calculado
  aqui.
- **Humano grava.** Aprovação explícita por etapa é o único caminho de escrita.

### Port & adapter

`IntentParserPort` + `GeminiIntentAdapter`. Gemini é conta que o Eliab já tem — razão
comercial, portanto configuração, não arquitetura (Visão Geral §2.6: nenhum
`if (provedor === ...)` fora de adapter). **O frontend nunca fala com o Google**; fala
com o backend.

### Contrato (proposta — fechar na fatia do backend)

```
POST /api/intent          { text }            → { plan }
POST /api/intent/draft    { command }         → { draft }
POST /api/intent/approve  { draftId, fields } → { result }
```

```json
{
  "command": "SetRolePermissions",
  "confidence": 0.82,
  "fields": {
    "roleId":      { "value": "…", "origin": "mencionado na fala", "review": false },
    "permissions": { "value": null, "origin": null, "review": true }
  },
  "unresolved": ["quais permissões exatamente"]
}
```

`origin` por campo é **obrigatório** — é o que sustenta a exibição de procedência (§6.1).

### Catálogo de comandos desta fase

`CreateCompany` · `UpdateCompany` · `InviteUser` · `UpdateUser` · `AssignRole` ·
`CreateRole` · `SetRolePermissions` · `ToggleModule` · `UploadCompanyCertificate`

Intenção fora do catálogo resolve em **"ainda não sei fazer isso"** com o caminho de
tela correspondente. Essa resposta é parte do produto, não falha — e é o estado mais
frequente nesta fase.

## 3. Navegação — contextual (decidido)

A barra de telas **não aparece na Mesa**. Aparece quando o usuário está dentro de uma
tela. `Esc` volta para a Mesa de qualquer lugar.

A regra que sustenta a tese, e que deve ir na interface com estas palavras:

> Módulo inativo nunca é proposto e não gera tela de operação. As telas de cadastro e
> configuração são CORE — fixas, não derivam de módulo. Desligar VND não tira Contato
> ou Produto daqui; tira o pedido das minhas propostas.

Ou seja: **a barra é fixa** (telas CORE), e é a lista de propostas que varia com os
módulos. Não implemente barra derivada de `plano ∩ conta ∩ papel` — derivada é a
proposta, não a navegação.

## 4. Mesa

Elementos, em ordem de peso visual:

1. **Saudação** com nome, data e módulo de contexto.
2. **Campo de intenção** — texto e voz lado a lado. É o elemento dominante.
3. **Plano entendido** — quando a intenção resolve: título, passos numerados com o
   módulo de cada um, botão de ação, e a linha *"nada é gravado antes da sua aprovação
   em cada etapa"*.
4. **"Já preparei — falta você olhar"** — lista de pendências (§4.1).
5. **Lateral:** "feito sozinho hoje" (ações automáticas concluídas, sem decisão
   pendente) e "módulos ativos nesta conta" com a nota do §3.

> ⚠️ **"Feito sozinho hoje" está OMITIDO da implementação** (decidido por Eliab, 12/08/2026). Não
> existe fonte de dados: nenhuma ação automática concluída é registrada em lugar algum, e nesta fase
> **nada acontece sem aprovação humana** — então não há o que listar. Preencher a seção com exemplo
> seria ornamento, e ornamento numa interface que pede confiança é pior que ausência: ele treina o
> operador a não ler o que a Mesa afirma.
>
> A seção volta com a fatia que produzir ações automáticas de verdade (conciliação, NF-e autorizada,
> preço de fornecedor atualizado — os exemplos do protótipo são todos de módulos que ainda não
> existem). Junto dela vem a pergunta de onde esses eventos são lidos: tabela própria, trilha de
> auditoria (ver `DEPENDENCIAS_EXTERNAS.md` §3) ou log de domínio.

### 4.1 A lista de pendências precisa separar naturezas

O protótipo mistura quatro coisas na mesma casca: rascunho aguardando aprovação, item
para revisar, e observação sem nada a aprovar ("a semana das duas empresas está
descolada"). Misturar *"decida isto"* com *"veja isto"* é como a mesa acumula ruído e o
usuário aprende a rolar sem ler.

**Separe em dois grupos:** o que exige decisão e o que é informação. O custo em
aprovações ("2 aprovações") pertence ao grupo de decisão e merece peso visual — um item
que custa duas decisões não é igual a um que custa uma.

### 4.2 Estado vazio

**Obrigatório.** Mesa sem pendências é o estado normal na maior parte do tempo, e
especialmente nesta fase (nove comandos). Sem estado vazio desenhado, o dia comum
parece sistema quebrado. Ele deve convidar à intenção, não pedir desculpas.

## 5. Telas com backend

### 5.1 Papéis — frase → permissões

A melhor ideia do protótipo, e tem backend pronto.

> Dono de loja não conhece `contacts.credit_limit.edit`. Ele conhece "a Ana pode vender,
> mas não pode mexer em preço nem dar desconto".

O usuário escreve ou fala a frase; a tela mostra a tradução linha a linha, cada
permissão com **estado** (permitido / negado / a decidir) e **o porquê**, citando o
trecho da frase que a originou.

**O estado "a decidir" é requisito, não enfeite.** No protótipo:
`reports.export → a decidir → "sua frase não disse — não vou supor"`. É a regra de
não-default-silencioso renderizada em UI, e é o que impede a tradução de inventar
permissão. Nunca resolva um silêncio como negado nem como permitido.

Restrições do backend a respeitar:

- Os sete papéis padrão **são editáveis** (§3.3 do CORE: "ajustáveis por conta") —
  nome, descrição e permissões. `isSystem` bloqueia **exclusão**, não edição.
- A conta não pode ficar sem nenhum usuário capaz de administrar papéis (trava de
  auto-lockout). A UI mostra o impedimento antes da ação.
- A árvore completa continua acessível — ninguém *precisa* começar por ela.

### 5.2 Módulos — dependências antes do clique

Nove módulos do catálogo (CORE, VND, EST, ROT, FIN, COB, FIS, CAN, EXP). Cada card:
código, nome, dependências em texto e toggle.

- **CORE não é desativável.**
- Desativar módulo com dependente ativo é **bloqueado**, com a mensagem nomeando quem
  depende: *"Não é possível desativar FIN: COB depende dele."* **Nunca cascata
  silenciosa.**
- O impedimento aparece **antes do clique**, não como erro depois.
- Desativar **preserva dados** — diga isso na confirmação: *"os dados ficam intactos,
  voltam na reativação"*.
- Após desativar, a UI precisa tolerar **até 15 min de propagação** para outros usuários
  logados (ADR-0001) — imediato para quem executou. Não pareça quebrada nesse intervalo.

### 5.3 Empresas, usuários, auth

Já existem. Revestir com a casca nova, sem mudar contratos. Lembretes:

- **WhatsApp obrigatório** em todo usuário; recuperação por **código no WhatsApp**, não
  link de e-mail.
- Mensagens genéricas em login e recuperação: *"se o e-mail existir, enviaremos o
  código"*. **Nunca "e-mail não cadastrado"** — destrói o desenho anti-enumeração que já
  está implementado. O atraso progressivo por tentativas também não é anunciado.
- Empresa ativa é seletor global; toda operação declara a empresa.

## 6. Padrões transversais

### 6.1 Procedência por campo

Todo campo de rascunho exibe de onde veio: *"ouvido na sua fala"*, *"consulta de CNPJ
(port de provider)"*, *"padrão da empresa ativa"*, *"ajustado por você"*. Editar um
campo troca a procedência para "ajustado por você" e limpa o estado de revisão.

**Campo vindo de fonte externa não confiável** (mensagem recebida de terceiro) precisa
ser visualmente distinguível de campo ditado pelo operador — ver §7.

### 6.2 Campos a revisar sobem

Campos com `review: true` ordenam-se no topo, com marcação. O usuário vê primeiro o que
precisa de decisão, não a ordem do formulário.

### 6.3 Aprovação e desfazer

`⏎` aprova, `Esc` volta. Toda aprovação deixa **desfazer** disponível — a interface
convida a aprovar rápido, então precisa de rede de segurança. Defina e documente a
janela e o que é reversível.

### 6.4 Atrito calibrado

Proposta com `confidence` baixa, com campos `review` pendentes, ou com campo de origem
externa **não recebe o mesmo `⏎`** de uma proposta trivial. Uma interface que traz tudo
pronto treina o usuário a aprovar sem ler; o atrito é o antídoto.

## 7. Voz

O protótipo usa a Web Speech API (`SpeechRecognition`, `pt-BR`, contínua, com
resultados intermediários) e cai para ditado simulado quando não há microfone.

**Ponto que precisa de decisão consciente:** no Chrome, a Web Speech API **envia o áudio
para servidores do Google** — não é reconhecimento local. Somado ao Gemini no parser,
são dois caminhos de dados de cliente saindo para terceiro. Isso exige base legal e
provavelmente consentimento por conta (LGPD). Não é problema de frontend resolver, mas
a interface deve deixar visível quando algo foi processado por IA externa.

A transcrição fica anexada ao registro como origem do que foi feito — implemente isso,
é parte da procedência.

## 8. Regras que a interface não pode violar

- **Esconder não é proteger.** Item some do menu e rota não oferecida são UX. A
  fronteira é o servidor: autenticação → módulo ativo → permissão.
- **A IA não é caminho paralelo de autorização.** Comando emitido pelo modelo passa
  pelos mesmos guards que um clique. Se o papel não pode alterar permissões, pedir por
  voz também não pode.
- **Empresa é dimensão obrigatória.** Toda proposta declara em qual empresa opera.
- **Nada persiste sem aprovação humana explícita.**

## 9. Tokens visuais — no theme do MUI

As cores são o conteúdo desta seção; os nomes de variável do protótipo
(`--color-accent-100..900` etc.) eram convenção de CSS custom properties e **não** se aplicam a MUI.
Elas viram entradas do `createTheme`.

| Papel | Valores | Onde vive no theme |
|---|---|---|
| Base azul-noite | `#061a30` → `#0b2440` → `#103f5f` | `palette.background.default` / `paper` e `palette.primary.dark/main/light` |
| Acento ciano | `#22b5e0` · `#3fc9f2` · `#74dcf8` | `palette.secondary.dark/main/light` |
| Neutros frios | `#8aa3bd` · `#5b7794` · `#35506a` | `palette.text.primary/secondary` e `palette.divider` |

Os dois tokens fora da paleta padrão do MUI — o painel da Mesa e o estado de atenção — entram por
declaração de módulo (`declare module '@mui/material/styles'`), e não como cor solta no `sx`:
`palette.vx.panel` e `palette.vx.warn`. É o que mantém a regra do `CLAUDE.md` ("nunca cores
hardcoded — usar `theme.palette`") valendo para o que o desenho tem de próprio.

> ⚠️ **O tema vem ANTES da primeira tela.** Decidido (Eliab, 12/08/2026). O desenho do protótipo é
> específico — azul-noite denso, tipografia com peso, campo de intenção dominante — e MUI com tema
> mal configurado puxa tudo para a aparência padrão de Material. Construir tela primeiro e "ajustar o
> tema depois" significa reescrever cada tela, porque o que compensa um tema fraco é estilo local, e
> estilo local é exatamente o que o `CLAUDE.md` proíbe.

Interface em pt-BR; documentos, moeda e datas em padrão brasileiro.

## 10. Fora de escopo

Contato, Produto, `field_config`, Dashboard, pedido, PDV, fiscal, financeiro. Todos
chegam com suas fatias de backend. Não antecipe telas nem comandos — casca que suporta
comando inexistente é dívida, não preparo.

Decisões de estado, estrutura de rotas e camada de dados devem ser **propostas** antes
de implementadas; os padrões do repositório (hexagonal, ports por Symbol, DTOs
validados) não estão neste documento e prevalecem.
