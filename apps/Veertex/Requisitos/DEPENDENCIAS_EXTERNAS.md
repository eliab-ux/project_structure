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
| **Canal correto a partir de** | ⏳ *a preencher quando a mudança for confirmada* |

⚠️ **Esta linha fica em branco de propósito até a confirmação.** Ela responde "a partir de quando o
canal ficou correto", que é uma pergunta de auditoria — e uma data escrita por antecipação seria uma
afirmação sobre algo que ainda não foi verificado.

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

## 6. Microfone na Mesa — ditar em vez de digitar

| | |
|---|---|
| **Estado** | **Destravado com condição.** Só entra se o reconhecimento for LOCAL |
| **Data** | adiado em 2026-08-12 · destravado em 2026-08-14 |
| **Decisor** | Eliab |
| **Bloqueado por** | Medição: `pt-BR` disponível *on-device* no Chrome desta base de usuários |

O que mudou em 14/08/2026: existe caminho em que **o áudio não sai da máquina**. O Chrome expõe
reconhecimento *on-device* na Web Speech API (`processLocally: true`, com `available()` e `install()`
para o pacote de idioma). Nesse modo, o que chega ao Gemini é **o texto transcrito** — e texto ditado
pelo operador sobre a própria operação já está autorizado pelo §5. **A questão de LGPD se resolve por
construção, não por termo contratual.**

### A REGRA — decidida por Eliab em 14/08/2026, vale para qualquer implementação

1. **`processLocally: true` SEMPRE.** O padrão da API é `false`, e `false` deixa o navegador escolher
   — podendo mandar o áudio para a nuvem. O padrão da API é o oposto do nosso.
2. **`available()` diferente de `available` → o microfone NÃO APARECE.** Não desabilitado: ausente.
   Controle inerte é promessa de recurso que não existe (§10).
3. **Nunca cair para a nuvem por acidente.** Falha de reconhecimento local é falha, não é motivo para
   tentar o outro caminho. O erro `language-not-supported` é resposta legítima e final.

Estas três não são detalhe de implementação: são a razão de o item ter saído do adiamento. Uma
implementação que as viole reabre a decisão de LGPD que elas fecharam.

### O que falta medir antes de implementar

| Pergunta | Como responde | Estado |
|---|---|---|
| `pt-BR` existe on-device, e em qual qualidade (`command`/`dictation`/`conversation`)? | página de teste descartável, na máquina do Eliab | **pendente** |
| Qual versão do Chrome/Edge suporta `available()`/`processLocally`? | a mesma página reporta o user agent | **pendente** |
| Qualidade em frase real (nome próprio, sigla, código) | cinco frases ditadas na mesma página | **pendente** |

A lista pública de idiomas do Live Caption — mesmo motor — **inclui português**; o que não está
confirmado é se o pacote é `pt-BR` ou `pt-PT`, e se `dictation` está disponível para ele. Sem essa
resposta, não se escreve código: o valor inteiro do item depende dela.

**Se a medição der negativa**, o segundo caminho é Whisper em WASM (`transformers.js`) — áudio também
não sai, ao custo de 40–150 MB de modelo baixado uma vez e alguns segundos por frase. A escolha entre
qualidade e peso volta ao Eliab; não é decisão deste repositório.

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
