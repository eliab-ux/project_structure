# Plano Diário — histórico do desenvolvimento com o Claude

Registro do que foi construído, das decisões tomadas e do **porquê** de cada uma. O foco é o
raciocínio: o código já está no repositório, mas o motivo de ele ser assim se perde com a conversa.

Última atualização: **29/07/2026**.

---

## 1. O que o sistema faz

Envia automaticamente, todos os dias no horário escolhido, a leitura bíblica do dia em um grupo de
WhatsApp:

```
29 de JULHO
https://youtu.be/E0SiKFdpquo
```

Duas linhas, sem saudação, sem título do vídeo, sem `?si=` na URL. O texto vai como **legenda da
miniatura do vídeo** (ver §5.2).

Fonte de verdade dos requisitos: `Requisitos/PLANO_DIARIO_SPEC.md`.

---

## 2. Onde as coisas vivem

| Item | Local |
|---|---|
| Desenvolvimento | `C:\HD\Eliab\KAZATEM\apps\plano-diario` (monorepo KAZATEM) |
| Repositório de deploy | `C:\HD\Eliab\plano-diario` → `git@gitlab.com:eliab1/plano-diario.git`, branch `deploy` |
| Produção | Dokploy no mdantas, project `psi` |
| Domínio | `dayplan.equipamentospsi.com` (backend em `/api`, frontend em `/`) |
| Serviços no Dokploy | backend, frontend, PostgreSQL (`plano_diario`), Redis |
| Portas locais | backend 3011, frontend 3013 |

> O desenvolvimento acontece no monorepo e é **espelhado** para o repositório de deploy antes de
> cada push. O `robocopy /MIR` exclui `node_modules`, `dist`, `.next` e `.env`.

### Stack

Backend NestJS 10 + Fastify, MikroORM 6 (PostgreSQL), BullMQ + Redis, arquitetura hexagonal.
Frontend Next.js 14 (App Router) + Material-UI. Bounded contexts: `auth`, `user`, `whatsapp`,
`catalog`, `schedule`, `dispatch`.

---

## 3. O catálogo — a parte que mais custou a acertar

O plano tem **365 leituras**, começando em **01/01/2026**; a leitura 365 (Apocalipse 20-22) cai em
**31/12/2026**. O número do dia é a **posição na sequência**, não o número escrito no título do
vídeo do YouTube — porque a numeração do canal é furada:

- Os dias **96 e 97** foram publicados como "**Vídeo** 96" e "**Vídeo** 97" em vez de "Dia".
  Um regex que só olhasse "Dia" deixaria 1 Samuel 25-31 fora do plano — sete capítulos sem leitura,
  incluindo a morte de Saul. Foram os dois únicos casos em 526 vídeos.
- Existem **dois vídeos "Dia 218"** — desempatados pela data de publicação.
- O número **275 não existe** no canal, e não perde conteúdo: o 274 fecha Malaquias e o 276 abre
  Mateus.

Por isso `daily_videos` tem duas colunas: `day_number` (a posição, 1…365, que manda) e
`title_day_number` (o número do título, só para auditoria). A tela **Programação** mostra as duas
lado a lado e marca com chips os números repetidos e os saltos.

Âncoras reais do grupo que validaram o alinhamento:

```
28/07/2026 → Dia 209 - Isaías 29-31      02/10/2026 → Dia 274 - Malaquias 1-4
06/08/2026 → Dia 218 - Isaías 64-66      03/10/2026 → Dia 276 - Mateus 1-4
07/08/2026 → Dia 218 - Jeremias 1-3      31/12/2026 → Dia 365 - Apocalipse 20-22
```

---

## 4. Decisões de arquitetura que valem lembrar

**A URL do vídeo nunca é derivada de cálculo de data.** O cálculo produz apenas o número do dia; o
vídeo vem do catálogo. Não achou → exceção, o log registra `failed` e **nada é enviado**. Nunca um
vídeo aproximado, nunca o do dia anterior.

**Datas circulam como string ISO `yyyy-MM-dd`**, sem `Date` e sem hora. Isso elimina a classe de
bug em que "22:00 de 27/07 em UTC" é lido como 27/07 quando o usuário já está em 28/07. A única
conversão de fuso do sistema está em `shared/plan/local-date.ts`.

**Formatação de data em português é feita à mão** (`MONTHS_PT_BR`), sem depender do locale do
sistema operacional — locale de container é fonte clássica de "28 de July" em produção.

**Idempotência mora no banco, não na aplicação.** Um índice único parcial garante um envio agendado
por dia:

```sql
UNIQUE (schedule_id, reference_date) WHERE trigger = 'scheduled'
```

O envio **manual** fica de fora dessa unique de propósito: um teste manual nunca é bloqueado pelo
envio do dia, nem o consome.

**Um único tick por minuto para todos os usuários**, em vez de um job repetível por usuário. Assim
trocar de horário não exige reconciliar fila nenhuma, qualquer fuso funciona, e reiniciar o processo
não perde agendamento.

**Janela de recuperação de 3 horas.** Se o horário passou e não houve envio, o tick envia assim que
puder. Passada a janela, marca `skipped` — mandar a leitura do dia às 23h não faz sentido, e o
histórico precisa explicar o dia vazio.

**Jobs rodam dentro de `RequestContext.create`.** Job não é request HTTP, e o MikroORM proíbe o
EntityManager global. Sem isso o envio automático falharia em todas as execuções.

---

## 5. Funcionalidades entregues

### 5.1 Base

Cadastro e login (JWT próprio, refresh transparente no frontend), conexão do WhatsApp por QR Code
(instância própria por usuário, nome `pd_<uuid sem hífens>`), listagem e sincronização de grupos,
agendamento (grupo, horário, fuso, dia 1 do plano, template), envio diário, envio manual (limitado
a 3/hora), histórico, e a tela de Programação com as 365 leituras.

### 5.2 A mensagem vai como imagem com legenda

A prévia do link no WhatsApp é montada por **quem envia** — aqui, o Baileys dentro do container da
Evolution, que precisaria buscar a página do YouTube pelo IP do servidor. Quando não consegue,
engole o erro e manda texto puro, sem imagem. Foi o que acontecia.

Solução: o backend baixa a miniatura do CDN de imagens (`i.ytimg.com` — sem quota, sem chave,
responde a qualquer IP), em cascata `maxresdefault → sddefault → hqdefault`, e envia `sendMedia`
com as duas linhas de legenda.

Regras que o código sustenta:

- `VideoThumbnailPort.fetch` devolve `null` em vez de lançar. Miniatura é enfeite; **o dia nunca
  deixa de ser enviado por causa de uma imagem**.
- A miniatura é buscada **antes** de qualquer envio. Falha no envio da imagem **não** tenta o texto
  depois — aquele POST pode ter sido entregue, e o grupo receberia a leitura duas vezes.
- Envio não tem retentativa automática no adapter. Repetir um POST que deu erro de rede arrisca
  duplicar a mensagem; quem decide repetir é o BullMQ, com o log já marcado como falho.

> O `linkPreview: true` no `sendText` ficou como declaração de intenção, mas **não tem efeito**: a
> Evolution só desliga a prévia quando o valor é explicitamente `false`.

### 5.3 Envio no mesmo dia ou na véspera

Campo **"Quando enviar"** na Configuração, gravado em `day_offset`:

| Opção | `day_offset` | Às 10:00 de 29/07 o grupo recebe |
|---|---|---|
| No mesmo dia da leitura | `0` | a leitura de **29/07**, com "29 de JULHO" |
| Um dia antes (na véspera) | `1` | a leitura de **30/07**, com "30 de JULHO" |

O mecanismo já existia no domínio, mas estava **quebrado** para offset ≠ 0: o número do dia
respeitava o deslocamento e a data da mensagem não. Um envio na véspera diria "29 de JULHO" ao lado
do vídeo do dia 30 — o cabeçalho contradizendo o conteúdo, o pior erro possível aqui, porque quem lê
confia na data.

A `reference_date` do log continua sendo o **dia do envio**, não o da leitura: é a chave de
idempotência do "um envio por dia", e trocá-la permitiria dois envios no mesmo dia.

### 5.4 WhatsApp obrigatório e recuperação de senha

O cadastro exige o WhatsApp do dono da conta — não o grupo, o número pessoal. É a única via de
recuperação de senha.

O `PhoneNumber` normaliza qualquer forma digitada para E.164 sem `+` (`5511912345678`) e exige DDD
válido e nono dígito: um fixo de 10 dígitos não recebe WhatsApp, e aceitá-lo criaria uma conta que
nunca consegue recuperar a senha. A coluna é **anulável** porque as contas criadas antes do campo
não têm número; elas preenchem no card "WhatsApp de contato" na Configuração, ou por
`create:admin --phone`.

Fluxo: `POST /api/auth/forgot-password` (e-mail) → código de 6 dígitos pelo WhatsApp de suporte →
`POST /api/auth/reset-password` (e-mail, código, senha nova).

Decisões de segurança:

- **A resposta do passo 1 é sempre a mesma**, exista a conta ou não — inclusive conta desativada,
  sem WhatsApp, ou acima do limite. Um 404 ali viraria um verificador de e-mails cadastrados.
- **A verificação do canal acontece antes de tocar no banco.** Se o canal quebrado só falhasse na
  hora de enviar, e-mail real daria erro e e-mail inexistente daria 200 — entregando quais contas
  existem.
- **O código nunca é guardado em claro**, só o hash bcrypt.
- **Vale 15 minutos, uma vez só, 5 tentativas.** Cada erro é contado *antes* da recusa: é o que
  transforma 1.000.000 de combinações em 5 chances.
- **Todas as recusas do passo 2 têm a mesma mensagem.** Distinguir "código errado" de "código
  inexistente" contaria se um código já havia sido pedido.
- **O limite de 3/hora conta envios, não tentativas** (ver §6.5).
- Limitação assumida: trocar a senha **não** derruba sessões abertas, porque os refresh tokens são
  JWT sem lista de revogação.

O canal fica atrás de `SupportMessengerPort`, separado do `WhatsappGatewayPort` de propósito: aquele
é a conexão **do usuário**, este é a conta de suporte da operação. Se o WhatsApp do usuário cair, a
recuperação continua funcionando.

---

## 6. Bugs encontrados, e o que cada um ensinou

### 6.1 O `:` no jobId — o que derrubou o envio automático

**Sintoma:** nada no Histórico, nem "Falhou" nem "Ignorado", enquanto o "Enviar agora" funcionava
perfeitamente.

**Causa:** a validação do BullMQ é

```js
if (jobId.includes(':') && jobId.split(':').length !== 3) throw 'Custom Id cannot contain :'
```

Ela tolera `:` **apenas quando o id tem exatamente 3 partes** — compatibilidade temporária com ids
antigos de repeatable, com um TODO no próprio código deles para remover. O id original
(`send:<id>:<data>`) passava por acaso, com 3 partes. Ao acrescentar o minuto para corrigir o
catch-up, virou 4 partes e passou a estourar **dentro do tick**, derrubando o agendador inteiro a
cada minuto, antes de qualquer decisão chegar ao banco.

**Correção:** `dispatchSendJobId()` monta o id com `_`, numa função própria, com a restrição
explicada e coberta por teste — inclusive um que verifica que nenhum *nome* de job usa `:`.

**Lição:** era uma regra invisível de biblioteca escondida dentro de um template string.

### 6.2 O catch-up que nunca recuperava

O catch-up chamava `createPending`, batia na unique parcial do dia, recebia "duplicado" e desistia —
um dia que falhasse ficava falhado para sempre. Agora ele lê o log do dia: já enviado, não faz nada;
falhou, **reaproveita o log** (`existingLogId`) e reenvia.

### 6.3 A instância apagada no provider

Apagar a instância no Evolution Manager deixava o registro do banco apontando para o vazio, e como o
nome deriva do id do usuário, toda tentativa de conectar batia no mesmo 404, sem saída pela
interface. Agora o 404 do `/instance/connect` é tratado como estado de negócio
(`ProviderInstanceMissingException`), e o use case **recria a instância** e pede o QR uma vez —
reaproveitando o registro local (mesmo id, grupos e histórico preservados), só trocando o token.

### 6.4 O 500 opaco na recuperação de senha

Faltava configuração do canal, e o adapter lançava um `Error` cru que virava "Erro interno". Para
quem usa, indistinguível de bug; para quem opera, invisível até alguém tentar. Virou
`SupportChannelUnavailableException` → **503** (falha do servidor, não do pedido), verificada antes
de qualquer consulta, mais um **aviso no boot** dizendo quais variáveis faltam.

> O aviso no boot **não derruba a aplicação** de propósito: recuperação de senha é um recurso entre
> vários, e um `throw` na subida tiraria do ar o envio diário, que é a razão do sistema existir.

### 6.5 O limite que contava o que não saiu

O código era salvo **antes** do envio e o limite contava por `created_at`. Enquanto o canal estava
sem configuração, cada tentativa gravava um código e falhava — três falhas de infraestrutura
consumiram a cota e travaram a recuperação por uma hora sem uma única mensagem ter saído. Agora
existe `sent_at`, gravado só depois do envio dar certo, e o limite conta apenas envios.

### 6.6 A tela que mentia sobre o agendamento ativo

Depois de salvar a configuração, a tela forçava o switch para "ativo" sem o backend ter mudado nada
— o `upsert` não toca em `is_active`. Com o agendamento pausado no banco, a tela dizia "envio
automático ativo", o tick ignorava, e não havia como perceber. Passa a refletir o que o servidor
devolveu.

### 6.7 Outros

- **Redis inacessível impedia a API inteira de subir**: `onApplicationBootstrap` roda dentro do
  `app.listen()`, então esperar por um Redis morto ali nunca deixava a aplicação servir HTTP.
  Registro dos jobs virou fire-and-forget com timeout.
- **Listar grupos leva ~22 segundos** (o Baileys busca metadados de todos os grupos). Com o timeout
  padrão de 10s a chamada abortava, era lida como falha de rede e repetida 3 vezes — enquanto o
  provider respondia 200. Timeout próprio de 90s, com uma única retentativa.
- **`?refresh=ture`** era silenciosamente convertido para `false` pelo `enableImplicitConversion`.
  Passou a ser validado como string.
- **`{{link}}` no template**: o backend substitui apenas `{{date}}` e `{{url}}`; qualquer outra
  coisa entre chaves é copiada literalmente e chega no grupo com as chaves à mostra. O formulário
  agora recusa. A validação ficou no formulário e **não** no Value Object porque o `create` também
  roda na volta do banco — recusar ali faria um template já salvo derrubar o `GET /api/schedule`.

---

## 7. Instrumentação — o que fazer quando "não enviou"

A caçada do §6.1 custou horas porque o agendador era uma caixa preta. Três instrumentos resolveram
isso e continuam disponíveis:

**1. `GET /api/health`** — responde de fora, sem entrar no container:

```json
"scheduler": { "enabled": true, "ticks": 42, "lastTickAt": "…", "lastDue": 0,
               "plans": 42, "lastErrorAt": null, "lastErrorStage": null }
```

| Estado | Significado |
|---|---|
| `enabled: false` | `REDIS_HOST` ausente; o módulo de jobs nem foi carregado |
| `enabled: true, ticks: 0` | módulo carregado, worker não consome (Redis inacessível) |
| `lastTickAt` recente | agendador vivo — a causa está no agendamento |
| `lastErrorStage` | `plan` (carregar/decidir), `enqueue` (enfileirar) ou `send` |

Só contadores e horários vão para o health, nunca a mensagem da exceção: o endpoint é público, e
mensagem de erro carrega caminho de arquivo, SQL e nome de coluna.

**2. Batimento no log** — `Agendador ativo`, no primeiro tick após o boot e depois a cada 15
minutos, listando cada agendamento ativo com o horário alvo **ao lado da hora local que o tick está
vendo** e o fuso. Erro de fuso fica visível na própria linha.

**3. Motivo da decisão** — `Agendamento não enviado`, com `ja-enviado-hoje` (mais o id, status e
trigger do log que bloqueou) ou `fora-da-janela-de-recuperacao` (mais os minutos de atraso).
"Ainda não chegou a hora" fica de fora: é o caso da maioria dos ticks e afogaria o log.

**4. `try/catch` no processor** — antes, exceção no tick virava só um job `failed` dentro do Redis e
o log da aplicação não dizia uma palavra.

---

## 8. Configuração de produção

Variáveis no Environment do **backend** no Dokploy (valores nunca no repositório):

```env
DATABASE_URL=              # Postgres interno do Dokploy
REDIS_HOST=                # Internal Host real do serviço Redis, não o nome amigável
REDIS_PASSWORD=
REDIS_PREFIX=plano-diario  # sem isso as chaves colidem com as de outro app no mesmo Redis
DISPATCH_ENABLED=true
JWT_ACCESS_SECRET=  JWT_REFRESH_SECRET=
ENCRYPTION_KEY=            # AES-256-GCM do token da instância (32 bytes hex)
YOUTUBE_API_KEY=
EVOLUTION_API_URL=https://evo2.techbs.com.br
EVOLUTION_API_KEY=         # chave GLOBAL — só para criar/apagar instância
EVOLUTION_SUPPORT_INSTANCE=emdr
EVOLUTION_SUPPORT_APIKEY=  # apikey DA INSTÂNCIA — nunca a global
CORS_ORIGIN=https://dayplan.equipamentospsi.com
```

> **Environment só vale em deploy novo.** Salvar sem redeployar não muda o processo em execução.

**A instância de suporte chama-se `emdr`** — "Suporte PSI" é o nome do *perfil* do WhatsApp
(556292238416). É a **mesma instância do EMDR Remoto**: os dois sistemas enviam pelo mesmo número.

As migrations rodam sozinhas no boot (`runPendingMigrations` antes do `app.listen()`).

---

## 9. Receitas operacionais

```bash
# O agendador está vivo?
curl -s https://dayplan.equipamentospsi.com/api/health

# Popular/atualizar o catálogo (dentro do container do backend)
cd /repo/apps/plano-diario/backend && node dist/scripts/sync-catalog.js

# Criar ou promover um admin
npm run create:admin -- --email=<email> --password=<senha> --phone="(11) 91234-5678"
```

**Liberar o envio automático de um dia já enviado** (só faz sentido em teste — remove a garantia de
um envio por dia daquele dia):

```sql
DELETE FROM dispatch_logs
WHERE schedule_id = '<uuid>' AND reference_date = '<yyyy-mm-dd>' AND trigger = 'scheduled';
```

As três condições juntas são o que torna isso seguro: um agendamento, um dia, e só o registro
automático.

---

## 10. Estado em 29/07/2026 e pendências

**Funcionando e verificado em produção:** WhatsApp pareado, grupos sincronizados, catálogo com 365
leituras, envio manual, envio automático (confirmado pelo health: `lastDue` indo de 1 para 0 no tick
seguinte), miniatura com legenda, Histórico com hora e mensagem exata, busca por data na Programação.

**Contas em produção:**

| Usuário | Agendamento | Horário | Quando enviar |
|---|---|---|---|
| `dec0e684-5112-472e-8f80-fc531f9556b5` | `07cb4a1a-9dcd-43f9-9a27-e645ccb649f5` | 18:10 | mesmo dia |
| `0559d3d3-6a29-4e18-837e-3df57198fdd5` | `a861b628-d28d-485b-8dbf-b538f71414f4` | 19:13 | véspera |

**Pendências:**

1. **Deploy do `198eaad`** (motivo da decisão no log) — só instrumentação, sem urgência.
2. **Duas contas com agendamento ativo** enviam todo dia em paralelo. Se não é intencional, pausar
   uma delas.
3. **Validar a véspera com um envio real** — a mensagem deve trazer a data do dia seguinte.
4. **Testar a recuperação de senha** ponta a ponta, com as variáveis do WhatsApp de suporte no ar.
5. **Rotacionar dois segredos** que foram expostos em conversa durante os testes: a senha do
   Postgres de produção e a apikey da instância `emdr`. Trocar a do Postgres exige atualizar o
   `DATABASE_URL` no Environment do backend e redeployar.
6. **Opcional:** Basic Auth no `/manager` do Evolution. Ele já exige a chave global para entrar,
   então não está exposto — seria defesa em profundidade.

---

## 11. Commits (mais recente primeiro)

```
198eaad  29/07 19:15  Tick registra POR QUE um agendamento ativo não foi enviado
a2d7f00  29/07 18:56  Corrige o jobId que derrubava o tick: BullMQ recusa ":" em jobId
e1be5d7  29/07 18:52  Health diz em qual etapa o tick quebra
aaa4ecb  29/07 18:26  Opção de enviar a leitura na véspera, e corrige a data da mensagem
45e997b  29/07 18:18  /api/health passa a provar se o agendador está rodando
26cc0f1  29/07 18:09  Batimento no log do agendador
52cbe0a  29/07 18:01  Barra placeholder inexistente no template da mensagem
0d8d959  29/07 15:08  Limite de recuperação de senha passa a contar envios, não tentativas
dac9413  29/07 14:36  Canal de recuperação ausente deixa de virar 500 opaco
e7ae7fd  29/07 13:51  Recupera a conexão quando a instância foi apagada no provider
2c2ab9c  29/07 12:00  WhatsApp obrigatório no cadastro e recuperação de senha por WhatsApp
364d6d6  29/07 10:25  A leitura passa a ser enviada como miniatura do vídeo com legenda
b62d85f  29/07 10:11  Recupera dias falhados, prévia do link e busca por data
75b2d59  28/07 20:19  Documenta que os scripts em produção exigem cd no diretório da app
2aa89f0  28/07 20:00  Configuração: dica do "Dia 1" calculada, e default 2026-01-01
7968cb3  28/07 18:52  Tela de Programação: as 365 leituras dentro do sistema
```

Antes disso: `a05ca26` (RequestContext nos jobs + CLI de sync), `cde29ee` (Redis inacessível não
derruba a API), `1c51c7c` (Fases 3 a 7).

---

## 12. Verificação

278 testes unitários, 25 suítes. Typecheck, lint e build limpos no backend e no frontend. O padrão
adotado antes de cada push: `typecheck` → `test` → `lint` → `build` → espelhar para o repositório de
deploy → auditar o diff em busca de segredo → commit → push.
