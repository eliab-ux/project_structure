# Dependências externas bloqueadas

Coisas que **não avançam por algo que não é código**. Cada item diz o que já funciona, o que falta, e
o que exatamente destrava.

Este arquivo existe para que "pendente" não seja confundido com "não feito", nem com "feito". São
**dois tipos de item**, e a distinção importa para quem lê procurando o que dá para retomar:

| Tipo | O que significa | Itens |
|---|---|---|
| **Pronto, bloqueado fora** | Implementado e testado até a fronteira; falta algo que não está aqui | 1 (WhatsApp), 2 (VEXGuard), 3 (Dokploy) |
| **Não construído, por decisão** | Deliberadamente não implementado; a decisão e o motivo estão registrados | 4 (`intent_draft`), 6 (microfone), 7 (imagem) |

O item 5 não é fatia: é o **gatilho de LGPD** que governa 6 e 7 e qualquer ampliação da origem do
input. Leia-o antes deles.

---

## 1. WhatsApp — instância de sistema do Evolution

| | |
|---|---|
| **Estado** | Implementado e testado até a fronteira do envio |
| **Bloqueado por** | Não existe instância de SISTEMA no Evolution (`evo2.techbs.com.br`) |
| **Impacto** | A recuperação de senha por código não funciona em produção |
| **Data** | 2026-08-11 |

### O que já funciona e está coberto por teste

`backend/test/integration/password-reset.spec.ts` — 13 testes, com o adapter **real**
(`EvolutionResetCodeMessenger`) fazendo a requisição HTTP de verdade contra um servidor Evolution de
mentira que registra o que chegou:

- `POST /message/sendText/{instância}` com o método e o caminho corretos;
- header `apikey` com a chave **da instância** — nunca a global do servidor;
- número só com dígitos, como o JID exige (`+5562…` vira `5562…`);
- texto com código de seis dígitos, **sem link** — código com link é o formato que golpista imita;
- código gerado com `randomInt` do `node:crypto`, gravado só como **hash bcrypt**;
- `sentAt` escrito apenas depois de o envio dar certo;
- um código vivo por vez: pedir outro invalida o anterior;
- cota de 3 pedidos por hora, contando **envios** e não tentativas;
- falha do canal não lança, não consome cota e não vira oráculo de enumeração;
- e-mail desconhecido responde igual a e-mail existente;
- TTL de 15 minutos;
- **5 tentativas erradas e o código morre** — inclusive para o palpite certo depois disso.

### O que falta

Só o elo que não controlamos: **o Evolution de verdade entregar a mensagem ao WhatsApp.** Nenhuma
mensagem real foi enviada até hoje.

### O que destrava

1. Criar uma instância de **sistema** no Evolution (não um chip de cliente — chip de campanha cai, e
   o canal de recuperação não pode cair com ele) e parear o número.
2. Preencher no ambiente do backend:
   ```env
   EVOLUTION_API_URL=https://evo2.techbs.com.br
   EVOLUTION_SYSTEM_INSTANCE=<nome da instância>
   EVOLUTION_SYSTEM_APIKEY=<apikey DA INSTÂNCIA, nunca a global>
   ```
3. Pedir um código para um usuário de teste com número real e confirmar a chegada.

Enquanto as três variáveis estiverem vazias, `ensureAvailable()` recusa o pedido **antes** de olhar
o usuário — de propósito: verificado depois, um e-mail cadastrado daria erro enquanto um inexistente
responderia 204, entregando quais contas existem.

---

## 2. VEXGuard — ferramenta própria de monitoramento

| | |
|---|---|
| **Estado** | Port e adapter no-op registrados; nada a fazer até a ferramenta existir |
| **Bloqueado por** | O `VEXGuard` ainda não foi desenvolvido |
| **Impacto** | Nenhum. Erros 500 são logados normalmente; só não são reportados a lugar nenhum |

`ERROR_REPORTER` está no container com `NoopErrorReporter`, e o `GlobalExceptionFilter` já dispara o
`report()` para exceções inesperadas. Quando o VEXGuard existir, troca-se a implementação do
provider e nada mais muda — é o desenho descrito no `CLAUDE.md`.

---

## 3. Deploy no Dokploy

| | |
|---|---|
| **Estado** | Adiado por decisão (2026-08-11) |
| **Bloqueado por** | Decisão de fazer tudo local primeiro |
| **Impacto** | A F1 é validada integralmente no Postgres local |

Existe no Dokploy apenas o serviço de **Postgres** (`veertex-veertex-eeilbu`). Não há evidência de
serviço de aplicação criado para o backend. Quando for a hora, `backend/deploy/README.md` §5 tem o
passo a passo, e `backend/deploy/verify/README.md` a fila de verificação.

---

## 4. Lista de pendentes da Mesa (§4.1) e a tabela `intent_draft`

| | |
|---|---|
| **Estado** | Fatia futura, com três decisões nomeadas e em aberto |
| **Bloqueado por** | Decisão de modelo de dados — não por falta de código |
| **Impacto** | A Mesa nasce sem a lista *"Já preparei — falta você olhar"*; o rascunho morre ao recarregar a página |
| **Data** | 2026-08-12 |

DECIDIDO (Eliab, 12/08/2026): **a fatia do endpoint de intenção NÃO cria tabela de rascunho.** O
contrato do §2 mantém `draftId` desde já — contrato estável, implementação temporária —, para que a
persistência, quando vier, não obrigue a mexer nos três endpoints e no cliente.

O motivo de adiar não é custo de implementação: **rascunho que morre ao recarregar comunica a verdade
do sistema — nada foi gravado.** Persistir exige decidir três coisas antes de existir com honestidade,
e nenhuma delas tem resposta óbvia:

1. **Retenção.** Quando um rascunho expira? Um rascunho de três semanas atrás não é trabalho
   pendente, é ruído — e ruído na Mesa é exatamente o que o §4.1 existe para evitar.
2. **Visibilidade.** Só quem criou, ou toda a conta? "Já preparei" é primeira pessoa; se o rascunho de
   um usuário aparece na Mesa de outro, a frase mente. Mas um rascunho que só o autor vê pode
   travar uma aprovação quando ele está de férias.
3. **Exportabilidade no cancelamento.** O §3.1 do CORE manda exportar os dados antes de cancelar a
   conta ("padrão Bling — nunca prender dados"). Rascunho não aprovado é dado do cliente? Se sim,
   entra na exportação; se não, é preciso dizer por quê.

Quando a fatia vier, a tabela é de TENANT: `account_id NOT NULL` + RLS por `account_id`, como toda
tabela de negócio (§3.1) — diferente da tabela de auditoria pré-autenticação do item 5 abaixo, que
não é dado de tenant.

⚠️ Estas três perguntas estão escritas aqui para **chegarem como pergunta**. Quem implementar não
deve escolher retenção, visibilidade ou exportabilidade por conta própria: seria o mesmo tipo de
default silencioso que produziu o `maxCompanies` — um número que requisito nenhum pediu e que só
apareceu quando alguém foi conferir.

---

## 5. LGPD na tradução de intenção — gatilho de reavaliação

| | |
|---|---|
| **Estado** | Autorizado a prosseguir nesta fatia; gatilho registrado |
| **Data** | 2026-08-12 |
| **Decisor** | Eliab |

DECIDIDO: **prosseguir.** Nesta fatia o input é o **operador da conta ditando sobre a operação da
própria conta**, e a base legal é **execução de contrato**. O texto sai para o Gemini; o adapter não
registra o texto em log (é dado de negócio do cliente, e um log de intenções seria o registro de tudo
o que se tentou fazer na conta).

**Voz fica FORA desta fatia**, e não por escopo: a Web Speech API do Chrome **envia o áudio para
servidores do Google** — não é reconhecimento local. É o que mais pesa na decisão, e o parser de texto
prova a arquitetura inteira sem esse peso.

### ⚠️ Free tier: compartilhamento para melhoria de produto — achado em 14/08/2026

O §5 autorizou **processamento**. Não discutiu **compartilhamento com terceiro que usa o dado para
melhorar o próprio produto** — e era isso que estava acontecendo, porque a chave em uso é de free
tier.

Documentação do Google, verificada em 14/08/2026: no free tier do Gemini API / AI Studio, o conteúdo
enviado **é usado para melhorar os produtos do Google, e revisores humanos podem vê-lo**. No tier
pago (e no Vertex AI), os termos dizem o oposto: prompts e respostas não são usados para treino, e
ficam retidos por período limitado apenas para abuso e obrigação legal.

Na prática: as frases da Mesa e as frases de permissão — *"a Ana pode vender mas não pode dar
desconto"* — passaram por um canal onde podiam ser lidas por pessoas e usadas para treinar modelo.
Não é vazamento nem defeito de código; é uma condição do canal que ninguém tinha lido.

| | |
|---|---|
| **Achado em** | 2026-08-14 |
| **Decisão** | Eliab ativa o billing na chave (muda os termos aplicáveis; nenhuma linha de código) |
| **Canal correto a partir de** | **2026-08-15** |

**O que sustenta essa data, e o que não sustenta.** Eliab informou em 15/08/2026 que a chave em uso é
a do projeto **`spread-492715`, com billing ativo** — e os termos pagos do Gemini valem por projeto,
não por chave. Verificado por mim naquele dia: a chamada de texto responde **HTTP 200** no
`gemini-2.5-flash`. **Não verificado por mim:** o estado do billing, que não é observável pela API —
é declaração do Eliab, e está registrada como tal.

### Chave própria do Veertex — proposta em 14/08/2026, NÃO adotada em 15/08/2026

O Veertex usa **a mesma chave do SpreadGuard** (projeto `spread-492715`), copiada em 13/08/2026
porque era o caminho mais curto para a Mesa funcionar. Chegou-se a propor criar projeto e chave
próprios; em 15/08/2026 Eliab decidiu **manter a compartilhada**, já que ela tem billing ativo e é o
billing que resolvia o problema urgente. Os motivos abaixo continuam válidos e viraram pendência com
gatilho — ver o fim desta seção.

**Os três motivos, escritos para não se perderem** — nenhum deles é sobre a Mesa funcionar melhor:

| Motivo | O que quebra hoje |
|---|---|
| **Custo não é atribuível** | Toda chamada dos dois produtos cai na mesma fatura, sem separação. Não dá para responder "quanto custa a Mesa por mês" — e sem essa resposta não dá para decidir se um comando caro vale a pena |
| **A cota é dividida** | Rate limit e quota são do projeto, não do produto. Um pico no SpreadGuard degrada a Mesa do Veertex, e vice-versa — com a agravante de que o culpado não aparece em lugar nenhum: a tela só fica lenta ou recusa |
| **Um vazamento derruba os dois** | Chave comprometida obriga a rotacionar nos dois produtos ao mesmo tempo, e a janela entre "vazou" e "todos rotacionaram" é o dobro da necessária. Raio de explosão é o que a separação reduz |

### ❌ A chave própria NÃO foi criada — decisão revista em 15/08/2026

Eliab decidiu **manter a chave do `spread-492715`**, compartilhada com o SpreadGuard, porque ela já
tem billing ativo e isso resolve o problema urgente (o compartilhamento de conteúdo para melhoria de
produto). A separação por produto vira **pendência sem urgência**.

| | |
|---|---|
| **Chave própria** | **não adotada** — decisão de 15/08/2026 |
| **Compartilhamento com o SpreadGuard** | **em vigor**, por decisão, desde 13/08/2026 |
| **Revisar quando** | o Veertex tiver **cliente em produção** |

Os três motivos que continuam valendo — nenhum deles urgente hoje, todos reais no dia em que houver
cliente pagando:

| Motivo | O que quebra enquanto durar |
|---|---|
| **Custo não é atribuível** | os dois produtos na mesma fatura. Não dá para responder "quanto custa a Mesa por mês", e sem isso não dá para decidir se um comando caro compensa |
| **Cota dividida** | rate limit é do projeto. Um pico no SpreadGuard degrada a Mesa, e o culpado não aparece: a tela só fica lenta ou recusa |
| **Vazamento derruba os dois** | rotação obrigatória nos dois produtos ao mesmo tempo, dobrando a janela entre "vazou" e "todos rotacionaram" |

⚠️ O gatilho é **cliente em produção**, e não uma data: hoje o custo é de desenvolvimento e o raio de
explosão é o ambiente do Eliab. Com cliente, as três linhas acima deixam de ser teóricas — e a
primeira delas passa a ser necessária para precificar.

### ⚠️ O gatilho — volta ao Eliab ANTES de ser implementado

**No momento em que o input passar a incluir mensagem recebida de cliente** — texto de WhatsApp de um
contato, e-mail de terceiro, qualquer conteúdo que não foi ditado pelo operador — a base legal muda:

1. deixa de ser execução de contrato, porque o titular do dado não é parte do contrato;
2. **exige consentimento** e
3. **exige aviso visível na interface** de que aquele conteúdo foi processado por IA externa.

O §6.1 da especificação de frontend já antecipa a metade visual disso: campo vindo de fonte externa
não confiável precisa ser **visualmente distinguível** de campo ditado pelo operador, e a procedência
`externo` existe no domínio (`FieldOrigin`) exatamente para isso. O que **não** existe é a base legal
nem o aviso.

Este item **volta como pergunta antes de qualquer implementação** que amplie a origem do input.
Ampliar por conta própria seria decidir sobre dado de terceiro sem base legal — que é uma classe de
default silencioso com consequência fora do código.

---

## 6. Ditado por voz — gravar no navegador, transcrever no Gemini

| | |
|---|---|
| **Estado** | **Implementado, DESLIGADO por flag.** Liga junto com a chave própria com billing ativo |
| **Data** | adiado 12/08 · destravado 14/08 · **redesenhado 15/08/2026** |
| **Decisor** | Eliab |
| **Bloqueado por** | `AUDIO_TRANSCRIPTION_ENABLED=false` enquanto a chave for free tier |

### ⚠️ CORREÇÃO DE PROCEDÊNCIA — 15/08/2026

A versão anterior desta seção apresentava três coisas numa tabela chamada "Medido". **Só uma foi
medida.** As outras duas vieram do texto de uma mensagem e eu as registrei como evidência. A
distinção importa porque decisão apoiada em número inventado é decisão sem apoio nenhum:

| Afirmação | Procedência REAL | Vale como evidência? |
|---|---|---|
| `pt-BR`: `command=available`, `dictation=unavailable` — e `dictation` indisponível também em `en-US` | **MEDIDO** por Eliab no Chrome 151, 14/08/2026, com a página de teste. O contraste com `en-US` é o que prova ser limitação do nível de qualidade, não falta de pacote português | **sim** |
| nome próprio derretia: *"Tudodicasa"* → *"de casa"* | **NÃO MEDIDO.** Veio no texto de uma mensagem. As transcrições da v1 saíram corrompidas por três bugs meus na própria página, e a v2/v3 nunca foram rodadas | **não** |
| 1 a 1,5 s perdidos entre pedir o microfone e ele ouvir | **NÃO MEDIDO.** Mesma origem | **não** |

E, por consequência, **também não foi medido** o que mais importa: se o nível `command` dá conta das
frases de permissão com negação (*"pode ver empresas mas não pode excluir empresa"*), se a negação
sobrevive, e se sigla de módulo chega utilizável. Qualquer conclusão sobre isso hoje é presunção.

### 📏 MEDIÇÃO 1 — 15/08/2026, 7 frases, locutor A, disparo em `pointerdown`

Primeira medição válida do ditado on-device. Ela **contradiz** a hipótese que motivou a troca por
áudio, e encontra um defeito diferente e pior.

| O que se mediu | Resultado |
|---|---|
| **Negação preservada** | **4/4.** Todas as frases com "mas não pode" mantiveram o "não". O nível `command` DÁ CONTA de frase corrida com negação |
| **Início da frase** | **5 de 7 corrompidos, sistematicamente** — verbo ou sujeito inicial comidos |
| `onstart` → primeiro resultado | 1,7 s a 3,6 s |

Exemplos do corte, como vieram:

| Falado | Transcrito |
|---|---|
| "criar papel de supervisor" | "papel de supervisor" |
| "cadastrar empresa …" | "para empresa …" |
| "o vendedor pode …" | "eu dou pode …" |
| "o supervisor pode ver …" | "pode ver …" |

### 🔴 ACHADO GRAVE — o corte não perdeu uma negação: INVENTOU uma

> **Falado:** *"a Ana pode vender e dar desconto até dez por cento mas não pode alterar preço de
> tabela"*
> **Transcrito:** *"**não pode vender** …"*

Uma frase que **concede** virou uma frase que **nega**. Isto é categoricamente diferente de perder o
"não", e é pior por dois motivos:

1. **A direção do erro é imprevisível.** O desenho inteiro foi pensado contra a perda da negação —
   inclusive a instrução ao transcritor, no caminho de áudio, que proíbe removê-la. Ninguém estava
   protegendo contra o oposto;
2. **O resultado é uma frase plausível.** "Não pode vender" é uma permissão que existe e faz sentido.
   Nada na cadeia acusa: a tradução aceita, a guarda de citação confirma o trecho (ele está no texto
   transcrito), e o rascunho mostra uma restrição coerente. **Só o operador lendo pega** — e é
   exatamente por isso que a transcrição é rascunho, nunca comando.

**O que este achado NÃO decide:** se o ditado serve ou não serve. A causa aparente é a latência de
abertura do microfone, não o nível `command` — e latência tem correção. Conclusão só depois da
segunda medição.

⚠️ **Uma ressalva de método, para a rodada 2.** O número citado acima (`onstart` → primeiro
resultado, 1,7–3,6 s) **não prova** o corte: ele inclui o tempo em que a pessoa está falando, e
1,7–3,6 s é o normal para uma frase inteira. Quem prova o corte é a coluna
**`start()` → `onstart`** — o intervalo em que o microfone ainda não estava capturando. A evidência
forte hoje é o PADRÃO das corrupções (sempre no começo, nunca no meio), que é consistente com o
corte mas não o mede. A rodada 2 precisa trazer essa coluna.

### O que foi decidido a partir do que ESTÁ medido

Com `command` disponível e `dictation` não, a decisão de Eliab (15/08/2026) é a que o próprio
critério dele já previa duas mensagens antes:

- **microfone on-device fica, e fica SÓ NA MESA** — frases curtas e imperativas (`ativar módulo VND`,
  `criar papel de supervisor`), que é o caso para o qual o nível `command` existe;
- **Papéis continua por texto**, sem microfone. Vale mesmo no melhor resultado da medição: ali uma
  negação perdida inverte uma permissão, e o custo do erro não se compara ao de digitar;
- **nada de áudio sai da máquina.** `processLocally: true` sempre; sem suporte local, sem microfone.

### O desenho atual

```
navegador grava (MediaRecorder, opus mono 16 kHz, teto de 60 s)
   → POST /intent/transcribe   (nosso backend, com a nossa chave)
   → Gemini transcreve LITERALMENTE
   → texto volta para o CAMPO da tela, como rascunho editável
   → o operador lê, corrige se quiser, e envia
   → daí em diante é o fluxo de intenção de sempre: POST /intent → rascunho → aprovação
```

**A interpretação continua nossa.** O provedor transcreve; quem traduz texto em comando é o catálogo
fechado, com `plano ∩ conta ∩ papel` e trecho de evidência. Pedir as duas coisas numa chamada só
pareceria mais simples e apagaria a fronteira onde a validação mora.

### As regras que sustentam a decisão

1. **A transcrição é RASCUNHO, nunca comando.** Vale para tudo, e vale em dobro na tela de Papéis:
   uma permissão invertida por erro de transcrição não pode chegar ao banco sem alguém ter lido. Se
   a transcrição perder o "não", a frase resultante é coerente, a guarda de citação confirma o trecho
   (ele existe no texto transcrito) e o operador aprovaria o oposto do que disse. **Nenhuma camada
   abaixo pega isso — só a leitura dele.**
2. **A instrução ao modelo proíbe reescrever, corrigir gramática e remover negação**, com exemplo
   concreto. Há teste prendendo essa linha: sabotá-la faz a suíte falhar.
3. **Falhou, o áudio FICA.** Erro de rede ou timeout mantém o blob e oferece retentar. Descartar o
   que a pessoa acabou de falar é o pior desfecho.
4. **O microfone só aparece se o backend disser que está ligado** (`GET /intent/capabilities`). Não é
   botão cinza: é ausência. A flag mora num lugar só, no servidor.
5. **O áudio nunca entra em log** — nem o base64, nem o tamanho em `catch`, nem a transcrição. Áudio
   de comando carrega nome de pessoa e de empresa.

### ⚠️ Por que nasce desligado

Enquanto a `GEMINI_API_KEY` for de free tier, o conteúdo enviado pode ser lido por revisor humano e
usado para treino (§5 acima). **Áudio de comando carrega nome de pessoa e de empresa — ele não sai
por esse canal.** A flag liga junto com a chave própria com billing ativo, nunca antes.

### 📏 MEDIÇÃO 2 — 19/08/2026, 8 frases, locutor A, modo `direto`, **uma frase por gravação**

**Medido por Eliab**, na página v10 em `localhost:3099`, com o autoteste do instrumento passando
(27/27). Uma repetição por frase — **não** as dez que o critério pede. Só o modo `direto` foi
exercido; `armado` e `aquecido` não entraram.

| O que se mediu | Resultado | Critério |
|---|---|---|
| **Início íntegro** | **100%** (8/8) | ≥ 95% |
| **Verbo** | **100%** (8/8) | ≥ 95% |
| **Negação preservada** | **100%** (4 de 4 frases com negação) | = 100% |
| **Negação INVENTADA** | **0** | qualquer uma reprova |
| Número ("dez por cento") | 1/1 | — |
| Entidades | exata 6 · aproximada 2 · **perdida 1** → 89% utilizável | — |
| Abertura (aperto → ouvindo) | **mediana 5 ms** (min 4, max 21) | — |
| `onstart` → 1º resultado | mediana 2,7 s | — |

**O corte do início desapareceu.** A medição 1 teve 5 de 7 frases com verbo ou sujeito comido, e
uma negação FABRICADA (*"a Ana pode vender"* → *"não pode vender"*). Aqui, nenhuma das duas coisas —
e a abertura do microfone, que na medição 1 aparecia como o suspeito, foi de **5 ms**.

⚠️ **Isto não conclui a decisão, e a diferença de protocolo é grande demais para atribuir causa.**
Entre as duas medições mudaram pelo menos três coisas ao mesmo tempo: a versão do instrumento (o
disparo, o índice de resultado lido, a acumulação), o número de frases por gravação, e a própria
sessão de fala. Um resultado limpo com n=1 por frase não distingue "o defeito era do instrumento" de
"o defeito era intermitente" de "o locutor falou diferente". As dez repetições e os três modos
existem para isso.

**O que sobrou como falha real, e é consistente com as duas medições:** nome próprio e sigla.

| Falado | Transcrito | Veredito |
|---|---|---|
| Tudodicasa | "tudo de casa" | **perdida** |
| COB | "cobre" | aproximada |
| Kaza Tem | "casa tem" | aproximada |

Nenhuma dessas é recuperável sem busca aproximada por entidade — que é o próximo passo já registrado
no ADR-0006. Um comando *"desativar módulo cobre"* não acha módulo nenhum; *"cadastrar empresa tudo
de casa"* cadastra uma empresa com o nome errado, e o operador precisa corrigir no rascunho.

### ⚠️ Os números desta medição foram RECONTADOS — o marcador estava errado

O CSV que a página produziu na hora trazia duas coisas falsas, ambas por casamento de **substring**
em vez de palavra:

1. **uma execução válida foi descartada**: a frase 7 (*"desativar módulo COB…"*) foi acusada de
   conter a frase 1 (*"ativar módulo VND"*), porque **"desativar" contém "ativar"** e "módulo"
   casava também — 2 de 3 palavras, acima do limite de 60%;
2. **`COB` foi contado como `exata`** para a transcrição "cobre", porque `"cobre".includes("cob")`.
   Erro **otimista**, na métrica que decide se código de módulo sobrevive ao ditado — e os códigos
   deste sistema são siglas de três letras (VND, COB, EST, FIS, CAN), o alvo mais frágil possível.

Uma terceira folga apareceu na verificação: com distância de edição, a palavra **"o"** contava como
`aproximada` para COB (duas inserções). Corrigido — para alvo de até 4 caracteres, só o **prefixo**
conta como recuperável.

Os **dados brutos** (transcrição e tempos) estavam corretos; o que estava errado era a pontuação. A
tabela acima é o resultado da recontagem com o marcador corrigido, e a rodada ficou **8/8 válidas**.

Este é o terceiro caso do instrumento produzindo número errado — os dois primeiros estão na regra 6
do `CLAUDE.md`, e este entrou nela junto com as oito transcrições reais, que agora são caso de
regressão do autoteste.

### A medição, quando ligar

Cinco frases, dez repetições cada, registrando **transcrição bruta**, **latência do fim da fala até o
texto na tela** e **tamanho do áudio enviado**. O instrumento já está no código: `vx_debug_audio=1`
no `localStorage` mostra os dois números abaixo do campo, a cada ditado.

```
ativar módulo VND
cadastrar empresa Tudodicasa Comércio de Utilidades
o supervisor pode ver empresas mas não pode excluir empresa
a Ana pode vender e dar desconto até dez por cento mas não pode alterar preço de tabela
a Bia pode registrar pagamento mas não pode criar reserva
```

| Critério | Limite |
|---|---|
| **Negação preservada** | **100%, sem exceção.** Uma falha que seja é reportada com a frase exata, nunca diluída numa média |
| Nome próprio e sigla | corretos, ou resolvíveis por busca aproximada |
| Latência mediana | abaixo de 2 s, do fim da fala ao texto |

## 7. Entrada por IMAGEM — ler documento de cliente e preparar o cadastro

| | |
|---|---|
| **Estado** | **Registrado, não implementado.** Três bloqueios, e nenhum é de esforço |
| **Data** | 2026-08-14 |
| **Decisor** | Eliab |
| **Impacto** | Cadastrar contato continua sendo digitação campo a campo, quando existir tela para isso |

A ideia: fotografar o documento do cliente, a IA lê, e a Mesa devolve o rascunho de cadastro para o
operador conferir e aprovar. É o mesmo desenho de três passos de sempre — traduzir, conferir, aprovar
—, com a imagem no lugar da frase.

**Três bloqueios, em ordem de dificuldade crescente:**

| | O que falta | Por que não dá para contornar |
|---|---|---|
| 1 | **O comando `CreateContact`** | O contexto `contact` não existe no backend (Visão Geral §4 o lista como previsto). Sem use case, o `approve` não teria o que executar: a Mesa aceitaria a foto, montaria o rascunho e falharia na aprovação — depois de o operador ter fotografado o documento de alguém |
| 2 | **`IntentParserPort` aceitando arquivo** | Hoje o contrato é `{ text }`. Imagem muda a assinatura do port, o corpo da requisição (base64 em JSON, como o resto do projeto — nunca multipart com Fastify), o limite de tamanho e o custo por chamada |
| 3 | **Decisão de LGPD mais pesada que a do texto** | Ver abaixo. É o bloqueio real |

### Por que o LGPD aqui é mais pesado que no texto — e não é uma questão de grau

O §5 autorizou o texto porque **o operador dita sobre a própria operação**: o titular do dado é a
conta, e a base é execução de contrato. Um documento de pessoa física inverte isso em três pontos:

1. **O titular é um terceiro** — o cliente fotografado, que não é parte do contrato entre o Veertex e
   a conta;
2. **traz CPF e RG**, e CPF é justamente o dado que o `CLAUDE.md` proíbe de aparecer em log — e um
   documento traz também nome da mãe, data de nascimento, filiação e, dependendo do documento, foto;
3. **a imagem inteira sai da empresa**, não os campos que interessam. Quem envia a foto de uma CNH
   envia a CNH, não "nome e CPF".

Ou seja: o gatilho do §5 ("input passa a incluir conteúdo de terceiro") dispara aqui **por
construção**, e com um conteúdo mais sensível do que a mensagem de WhatsApp que o §5 usou como
exemplo. Exige base legal para o tratamento, consentimento do titular, aviso visível na interface, e
uma decisão sobre retenção que o texto não exigiu: **a imagem é guardada? por quanto tempo? onde?**
Nenhuma dessas quatro é decisão de implementação.

### O desenho, CONFIRMADO por Eliab em 14/08/2026

Não implementar nada disto antes do `contact`. Registrado para que a fatia, quando vier, não redecida
o que já está decidido:

| Decisão | Detalhe |
|---|---|
| **A imagem não é guardada** | Processada para extrair campos e descartada. Sem `multer`, sem arquivo temporário, sem cache. O base64 vive no corpo da requisição e morre com ela |
| **O que persiste é o rascunho** | Nunca o arquivo. Com procedência dizendo que veio de imagem |
| **`FieldOrigin: 'externo'`** | O valor já existe no domínio desde o §6.1, declarado e nunca produzido — foi criado exatamente para "fonte externa não confiável precisa ser visualmente distinguível" |
| **`review: true` obrigatório** | Todo campo lido de imagem. OCR erra dígito de CPF, e campo desses aprovado sem leitura é cadastro errado com aparência de conferido |
| **base64 em JSON** | Padrão da casa; nunca multipart com Fastify. O `bodyLimit` já é 25 MB, mas a rota com anexo merece limite próprio, menor |
| **O base64 nunca entra em log** | Nem em erro, nem o tamanho dentro de `catch`. Mesma regra do texto, com mais peso |
| **O adapter determinístico RECUSA o anexo, em voz alta** | Ignorar em silêncio faria a suíte passar enquanto produção lê a imagem — a divergência que a regra 1 do `CLAUDE.md` proíbe |

O port muda em uma linha, aditiva: `attachment?: { mimeType, dataBase64 }` em `IntentParseRequest`.
**Não antes do `contact`** — sem `CreateContact`, seria assinatura esperando executor.

### ⚠️ A lacuna que o billing NÃO resolve — decisão de produto, antes de existir tela

Ativar o billing na chave do Gemini resolve *uma* coisa: os termos passam a dizer que o conteúdo não
é usado para melhorar produto do Google nem revisado por humano. **Isso não toca no problema
principal**, que é anterior ao provedor:

> **O titular da foto não é parte de contrato nenhum.** O contrato existe entre o Veertex e a conta.
> O cliente fotografado não assinou nada com o Veertex e, na maior parte dos casos, não sabe que a
> foto do documento dele foi enviada a um provedor de IA.

Nenhum termo contratual com o Google altera isso, porque o problema não é o que o Google faz com o
dado — é a **base legal para o dado ter saído**.

**Encaminhamento provável (Eliab, 14/08/2026), a confirmar antes da implementação:** aviso na tela
para quem fotografa, com o **consentimento sendo responsabilidade do usuário do Veertex** — ele é
quem tem a relação com o titular, e é quem pode pedir. O Veertex informa; o operador obtém.

Se for esse o desenho, três coisas passam a ser requisito e precisam estar escritas antes de a tela
existir:

1. **o texto do aviso** — dizer que a imagem é enviada a um provedor externo para leitura, que não
   fica guardada aqui, e que obter o consentimento do titular é responsabilidade de quem fotografa;
2. **quando ele aparece** — antes da câmera abrir, não depois da foto tirada. Aviso posterior é
   informação sobre algo que já aconteceu;
3. **se há registro de que foi exibido** — e aí volta a pergunta de auditoria do ADR-0004, que
   continua não implementada.

Nenhuma das três é decisão de implementação. **Elas voltam ao Eliab.**

### Quando isto voltar à mesa

Na ordem: primeiro a fatia de `contact` no backend (bloqueio 1), que é trabalho comum e sem decisão
pendente. Os bloqueios 2 e 3 só fazem sentido depois — e o 3 volta **como pergunta ao Eliab**, junto
com a do microfone, porque as duas são da mesma família: o que a empresa autoriza a sair dela.

---

## 8. Contato — o que ficou fora da fatia, e por quê

| | |
|---|---|
| **Estado** | Contato ENTREGUE (14/08/2026). Cinco partes do §3.4 ficaram fora, cada uma com motivo |
| **Decisor** | Eliab |

### ⚠️ Carteirização — fora POR INTEIRO, e nem a coluna existe

Decisão de Eliab, e é a que mais merece ser lida antes de alguém "só acrescentar o campo":

> *Visibilidade de dado neste sistema mora em RLS e guard. Coluna existindo sem o filtro é a pior
> configuração, porque alguém depois supõe que ela restringe algo.*

O §3.4 prevê `vendedor vinculado` e a preferência *"contato acessível somente ao vendedor vinculado"*.
Criar a coluna sem o filtro produziria o pior dos três estados possíveis:

| | O que o sistema faz | O que alguém acredita |
|---|---|---|
| Sem coluna (escolhido) | todo contato visível a quem tem `contacts.read` | o mesmo — não há o que supor |
| Coluna **com** filtro | vendedor vê só a carteira dele | o mesmo |
| Coluna **sem** filtro | todo contato visível a todos | *"tem vendedor vinculado, então está restrito"* — **falso** |

A terceira linha é uma falha de segurança que **se parece com uma funcionalidade**: não é detectável
por teste (o dado está lá) nem por leitura do schema (a coluna sugere a regra), e só aparece quando
alguém vê o contato de outro vendedor — quando a pergunta vira "desde quando?".

⚠️ **Efeito colateral hoje, e ele está escrito no papel padrão:** o `SALES_REP` recebeu
`contacts.read`, o que significa ver **todos** os contatos da conta, não só os dele. É o
comportamento correto na ausência de carteirização — e é exatamente o que muda quando ela chegar.

A carteirização volta INTEIRA: coluna, preferência da conta, filtro no use case a partir do `sub` do
token, e teste de isolamento por ator. Junto com o módulo que precisar dela (VND/ROT).

### As outras quatro

| O que | Por que fora |
|---|---|
| **`field_config`** | Não é pré-requisito: o §3.6 diz que o catálogo de campos é fixo em código, e ele foi construído assim — com `defaultVisible` **declarado campo a campo**, nunca inferido. Quando `field_config` existir, a mesma rota devolverá o catálogo mesclado com a config da conta, e a tela não muda |
| **Geocodificação** | Exige BullMQ e Redis — dependências novas. As colunas `latitude`/`longitude` existem nullable (acrescentá-las depois seria migration em tabela com linhas); nenhum job está registrado e nenhuma tela oferece mapa |
| **Tabela de preço** | `Product` não existe. FK para tabela inexistente é pior que ausência |
| **Campos de revendedor** | O §3.4 remete ao `04_Veertex_Rot.md`, que não foi lido. Requisito não se deduz |

### Duas preferências decididas por default, e escritas

O §3.4 prevê três preferências de conta, e a conta não tem onde guardá-las. Duas ganharam default
explícito (Eliab, 14/08/2026); a terceira é a carteirização acima:

- **unicidade de documento**: NÃO permitir duplicado. Dois cadastros com o mesmo CNPJ é o começo de
  duas verdades sobre o mesmo cliente, e desfazer exige mesclar histórico;
- **numeração de código**: MANUAL. Sequencial exige contador por tenant — lock ou sequence, design
  próprio, não um campo.

### O limite de crédito guarda valor e a TELA diz que não bloqueia

O §3.4 diz que o limite bloqueia venda acima, e quem aplica são VND/COB, que não existem. Correção
de Eliab: *"campo preenchido com um valor é promessa ao usuário, e ninguém lê comentário de código"*.
O aviso viaja no `hint` do catálogo de campos — vem do backend, aparece abaixo do campo, e **some
sozinho** no dia em que o VND aplicar de verdade. Há teste de contrato prendendo esse texto.

---

## 8. Produto (§3.5) — o que ficou fora, e o motivo de cada um

Fatia construída em 19/08/2026. O recorte foi aprovado por Eliab com três ajustes, e as ausências
abaixo são **decisão registrada**, no mesmo formato da carteirização do Contato: não são atrasos, são
escolhas com condição de volta.

### 🔴 KIT (`bundle`) — fora POR INTEIRO, nem a composição

Este é o ajuste mais importante do recorte, e a distinção é do Eliab:

> *Diferente do limite de crédito: o limite é um número que alguém consulta; o kit é estrutura de
> venda cujo sentido é baixar componente ao vender. Sem EST, o usuário monta a composição, vende, e
> nada se move no estoque — **não é campo inerte, é comportamento errado silencioso**. E o §3.5 remete
> o kit ao EST.*

A proposta inicial (minha) era construir a **composição** e avisar na tela que a baixa dependia do
EST — o mesmo tratamento do limite de crédito. Estava errada, e a razão cabe numa linha: **o limite de
crédito não faz nada e a tela diz isso; o kit pareceria ter funcionado.** O operador monta, vende, e a
venda acontece. Só que o estoque dos componentes fica intacto, e a diferença aparece semanas depois,
no inventário — quando ninguém liga mais uma coisa à outra.

| | O que o sistema faz | O que o usuário acredita |
|---|---|---|
| Sem kit (escolhido) | não dá para cadastrar kit; a mensagem diz que depende do módulo de Estoque | o mesmo — não há o que supor |
| Kit **com** EST | vende e baixa componentes | o mesmo |
| Kit **sem** EST | vende e **não baixa nada** | *"vendi o kit, o estoque baixou"* — **falso** |

**Como está impedido, e em duas camadas:** o enum tem `bundle` (o §3.5 pede enum aberto), e
`parseProductFormat` **recusa** com a mensagem que nomeia o módulo. Nenhuma tabela de composição foi
criada; a tela não oferece a opção porque `creatableFormats` vem do servidor.

**Volta INTEIRO com o EST:** composição, derivação de saldo e baixa ao vender. Não em partes.

### As outras seis

| O que | Por que fora | Condição de volta |
|---|---|---|
| **Variações (`variant`)** | §3.5: implementação antes do CAN completo, não agora. Enum aberto, criação recusada | módulo CAN |
| **Imagens / MinIO** | **MinIO não existe no ambiente** — verificado: nenhuma variável no `.env.example`, nenhuma dependência no `package.json`, nenhum serviço no `docker-compose.dev.yml`. Nem a tabela `product_images` foi criada: guardar chave de objeto que nada produz sugere um recurso que não há | MinIO provisionado |
| **CFOP** | §3.5, explícito: *"CFOP NÃO é campo de configuração global (erro do Nexo a não repetir)"*. Deriva de natureza de operação × contexto. Há um `export const CFOP_DELIBERADAMENTE_AUSENTE` no catálogo de campos, para quem for "só acrescentar o campo" encontrar a resposta antes | módulo FIS (e lá não será campo do produto) |
| **Herança do grupo fiscal** | o grupo entra como **rótulo** (texto, não FK). A tabela de grupos e a herança são regra do FIS | módulo FIS |
| **Saldo e custo médio** | do EST. O §3.5 diz que o custo médio é *"exibido aqui somente leitura"* — não há o que exibir sem o módulo, e coluna com número que ninguém atualiza é número que alguém soma | módulo EST |
| **Tabela de preço** | preço base só, como no Contato e pelo mesmo motivo | módulo de preços |

### Categoria — texto PROVISÓRIO, com o nome escolhido para a migração

Decisão do Eliab: *"texto simples, como você recomendou, mas registre como provisório e escolha o
nome da coluna pensando na migração para árvore. É o campo que mais vira árvore de verdade em ERP."*

Daí `category_path`, e não `category`. O valor é um **caminho** (`"Ferramentas > Manuais"`), que é a
forma que sobrevive: cada caminho distinto vira uma cadeia de nós, e o path continua verdadeiro como
caminho materializado. Quando a árvore existir, `category_id` entra **ao lado** — as duas coexistem
durante o backfill, e a antiga pode ficar como cache de exibição. Com o nome `category` sobraria um
campo ambíguo (é o id ou o texto?) exatamente no momento em que clareza importa.

O índice é `varchar_pattern_ops`, porque o filtro é por prefixo (`like 'Ferramentas%'`) e um btree com
o collate padrão **não** atende prefixo — funcionaria fazendo varredura completa, que é o defeito que
passa com 10 produtos e aparece com 10 mil.

### Unidade comercial — lista fechada, e uma ressalva de procedência

Decisão do Eliab: lista fechada com as siglas usuais, *"elas vão para a NF-e quando o FIS existir;
sigla inventada agora custa migração depois"*.

⚠️ **A ressalva, para ninguém escrever "tabela oficial" sem conferir** (regra 4 do `CLAUDE.md`): no
layout da NF-e a **unidade comercial** (`uCom`) é **texto livre de até 6 caracteres** — não há tabela
que a SEFAZ valide. O que tem tabela fechada é a **unidade tributável** (`uTrib`) de exportação, que é
outro campo. Portanto a lista adotada é o **conjunto convencional** do mercado, e o motivo dela é
qualidade de dado, não exigência fiscal. Se o FIS precisar de uma sigla fora dela, acrescentá-la é uma
linha — não uma migração.

A **origem da mercadoria** (0 a 8), essa sim, é tabela fechada da NF-e, e está implementada como tal.

### O widget de completude — a redação é a decisão

O §3.5 pede que a tela diga para o que o cadastro serve hoje. Duas das três finalidades dependem de
módulos que não existem, e a diferença entre duas frases parecidas é categórica:

| Frase | O que afirma | Verdadeira hoje? |
|---|---|---|
| *"pronto para emissão fiscal"* | sobre **o sistema** | **não** — sem FIS não há emissão |
| *"campos fiscais preenchidos"* | sobre **o cadastro** | sim, verificável |

Redação decidida por Eliab: a segunda, sempre, com o aviso de qual módulo falta. O aviso vem do
servidor (que conhece os módulos ativos pelo token) e **desaparece sozinho** quando o módulo é
ativado — mesmo desenho do `hint` do limite de crédito. Há teste prendendo os dois rótulos e a
ausência da palavra "pronto".

**Cotação de frete é a única finalidade completa de ponta a ponta**, porque peso e dimensão são dados
do produto e não dependem de módulo. É o que torna o widget útil em vez de decorativo — e a razão de
o bloco de medidas ser o único que nasce visível no catálogo de campos.
