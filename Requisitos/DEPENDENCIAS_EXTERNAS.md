# Dependências externas bloqueadas

Coisas que estão **prontas e testadas do nosso lado** e não podem ser concluídas porque dependem de
algo que ainda não existe fora do repositório. Cada item diz o que já funciona, o que falta, e o que
exatamente destrava.

Este arquivo existe para que "pendente" não seja confundido com "não feito", nem com "feito".

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
