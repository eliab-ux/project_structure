# Histórico das Conversas com o Claude — Veertex / ECOA

> **Para que serve:** o Eliab vai formatar a máquina. A memória automática do Claude é atrelada
> ao **caminho da pasta** (`...\projects\c--HD-Eliab-Veertex\memory\`) e se perde na formatação.
> Este arquivo é o registro da conversa: o que foi pedido, o que foi decidido, **por quê**, e o
> que ficou pendente.
>
> **Como retomar:** cole este arquivo numa conversa nova. Ele é o índice; os detalhes técnicos
> de cada sistema estão nos arquivos que ele referencia.
>
> Última atualização: **25/08/2026**.

---

## Índice dos documentos de histórico (todos na raiz do monorepo)

| Arquivo | Do que trata |
|---|---|
| **`HistoricoConversaIA.md`** (este) | Registro das conversas e das decisões |
| `HISTORICO_ClaudeIA.md` | Estado do **EMDR Remoto** (deploy, banco, billing, gotchas) |
| `HISTORICO_ClaudeIA-ECOA.md` | Estado do **ECOA** (deploy, App Review, pendências) |
| `RESUMO_CONVERSA.md` | Handoff antigo do ECOA (07/07/2026) — histórico |
| `RESUMO_CONVERSA-ECOA.md` | Handoff antigo do ECOA (28/07/2026) — histórico |
| `HISTORICO_CHAT.md` | Anterior, não revisado nesta conversa |
| `CLAUDE.md` | Regras de arquitetura e segurança do monorepo (**leitura obrigatória**) |
| `CLAUDE_PYTHON.md` | Idem, para apps Python |

---

## Mapa dos repositórios — leia antes de qualquer deploy

Esta foi a maior pegadinha da conversa. **O monorepo não é o que vai para produção.**

| Repositório | Caminho local | Remoto | Papel |
|---|---|---|---|
| **Veertex** (monorepo) | `C:\HD\Eliab\Veertex` | `origin` → GitHub `eliab-ux/project_structure`<br>`veertex` → GitLab `eliab1/veertex` | Onde se desenvolve |
| **ecoa** (standalone) | `C:\HD\Eliab\ecoa` | GitLab `eliab1/ecoa` (branch `main`) | **O que o Dokploy builda** |
| **emdrremoto** (standalone) | `C:\HD\Eliab\emdrremoto` | GitLab `eliab1/emdr` (branch `deploy`) | **O que o Dokploy builda** |

> ⚠️ **A sincronia entre monorepo e repo standalone é MANUAL.** Editar no `Veertex` e mandar
> deploy **não sobe nada** — o Dokploy nem olha para o monorepo. Isso aconteceu de verdade
> nesta conversa (ver §5).
>
> ⚠️ E a cópia **não é em bloco**: os repos standalone têm arquivos que o monorepo **não tem**
> (páginas `/privacy` e `/data-deletion`, `icon.png`, Dockerfiles enxutos, `api.ts` com base
> relativa `/api`, `package-lock` próprio). Copiar tudo por cima **apaga** esses arquivos.

---

## 1. O pedido inicial — separar o histórico do ECOA

**Pedido:** *"copie o histórico somente do ECOA"*, apontando o `HISTORICO_ClaudeIA.md`.

**O que se descobriu:** aquele arquivo é **100% do EMDR Remoto**. A única ocorrência de "ecoa"
nele é o nome de uma deploy key (`key-ecoa`). O histórico do ECOA estava em outros dois
arquivos: `RESUMO_CONVERSA-ECOA.md` (28/07) e `RESUMO_CONVERSA.md` (07/07).

**Feito:** criado `HISTORICO_ClaudeIA-ECOA.md`, consolidando os dois (o de 28/07 como versão
vigente; o de 07/07 só para o que ele registra a mais). O `HISTORICO_ClaudeIA.md` ficou intacto.

---

## 2. A 2ª reprovação da Meta

**Fato:** o painel da Meta mostrou **"Envio não aprovado"** com as **4 permissões
`Not approved`** — `pages_show_list`, `business_management`, `instagram_manage_insights`,
`instagram_basic`. Sem aprovação parcial.

> 📌 **Divergência nunca esclarecida:** o PDF do envio é de **28/07**, mas o painel datava o
> envio em **09/08 04:09 BRT**. Ou houve um 3º envio, ou é a data do reprocessamento.

> 📌 **O texto do feedback nunca foi lido.** Toda a análise abaixo é auditoria do envio contra o
> código — não é o motivo oficial. **Se o feedback ainda estiver acessível no painel
> ("Acessar o feedback do envio" → "Ver detalhes da solicitação"), cole em
> `apps/ecoa-system/docs/APP_REVIEW.md` §7.** As duas reprovações foram tratadas por hipótese
> justamente porque ninguém transcreveu esse texto.

### O que a auditoria encontrou

1. **Funcionalidade descrita sem a permissão que a habilita.** As instruções mandavam o revisor
   abrir "Detections" (webhook `mentions`), mas `instagram_manage_comments` nunca foi pedida.
2. **`business_management` injustificável pelo código** — mesmo erro que derrubou
   `pages_read_engagement` na 1ª rodada.
3. **O revisor tinha que trazer a própria conta Instagram profissional.** Se não tem uma
   vinculada a uma Página, o fluxo morre no diálogo do Facebook — e reprovação em bloco das
   quatro, sem aprovação parcial, é a assinatura disso.
4. **Erro em português** num app declarado em inglês (e que virava 500 genérico).
5. **Um vídeo só para 4 permissões**, admitindo que duas "are not shown directly in the UI".
6. **Justificativas diziam "só o dono"** enquanto o código lia perfis de terceiros via
   `business_discovery`.

---

## 3. 🔴 A descoberta que mudou o produto

Ao conferir o webhook `mentions` na doc oficial — coisa que o próprio `ECOA_SPEC.md` mandava
fazer *"antes de escrever qualquer chamada"* e que **nunca tinha sido feita** — veio:

> **"Mentions on Stories are not supported."**
> https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/mentions/

O ECOA foi desenhado para detectar *"alguém compartilhou seu post no story pelo aviãozinho com o
@ preservado"*. **Isso não é detectável** por esse caminho, com ou sem aprovação da Meta.

- **Detectável:** menção na **legenda** de um post alheio, menção em **comentário**, **marcação**.
- **Não detectável:** reshare de **story**.
- **Existe outro caminho para story**, mas é outro produto: Instagram **Messaging** API
  (webhook `story_mention` + `instagram_manage_messages`), com trilha de review própria e mais
  rígida.

### Decisão do Eliab: opção 1

Redefinir o Detections para o que a API entrega. Story mention pela Messaging API fica como
investigação futura, **sem travar** o 3º envio.

> **Esclarecimento que o Eliab pediu na conversa:** em **modo Development** as permissões já
> funcionam para quem tem **cargo no app** (admin/developer/tester). Ele é admin, então
> **consegue** demonstrar o Detections funcionando **antes** da aprovação da Meta. A aprovação só
> é necessária para **outros** usuários.

---

## 4. O que foi implementado (25/08/2026)

### Detections realinhado
- `DetectionType` reescrito: `caption_mention` | `comment_mention` | `tag`. Saíram
  `story_mention` (**nunca foi verdade** — mapeava o campo `mentions`) e o genérico `mention`.
- `mapType` do webhook distingue legenda de comentário pelo `comment_id` do payload.
- `reconcile-mentions` grava `TAG` (o job lê o edge `/tags`).
- UI corrigida em EN e PT: declara que story é invisível; saiu o jargão interno
  *"modo Opção A"*, que vazava para o usuário.

### Escopos do OAuth
- **Entra** `instagram_manage_comments` (habilita o webhook `mentions`).
- **Sai** `business_management`.
- Final: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
  `instagram_manage_comments`.

### Campanhas REMOVIDAS do produto (pedido do Eliab — não eram usadas)
Contexto `campaign` inteiro, controller, repositório, mapper, ORM entity, `assign-campaign`,
`PATCH /media/:id/campaign`, rota `/campaigns`, service, menu, tipos e chaves i18n.

> Isso **não** reduziu nenhuma exigência da Meta (campanha era agrupamento interno), mas encolheu
> o app que o revisor percorre.

### Fluxo de conexão
- `NoLinkedInstagramAccountException` (400 explicativo) no lugar do `Error` em português que
  virava 500 genérico.
- Aviso no log quando há mais de uma Página elegível, em vez de escolher a primeira em silêncio.
- As 4 mensagens em pt-BR do caminho do revisor foram para inglês.

### SQL (idempotentes, NÃO rodados)
- `deploy/sql/02_drop_campaign.sql` — **destrutivo**: dropa `campaign` e `own_media.campaign_id`.
- `deploy/sql/03_detection_types.sql` — migra os tipos antigos e **aborta** se sobrar inválido.

### `docs/APP_REVIEW.md` reescrito
O 3º envio pronto para copiar: justificativa por permissão **alinhada ao código real** (incluindo
o `business_discovery`, que era omitido), instruções que **não** exigem conta própria do revisor,
roteiro de vídeo **por permissão**, data handling e checklist.
A senha da conta de teste saiu do arquivo versionado (virou `<SENHA>`).

> **Correção registrada:** eu havia afirmado que o `APP_REVIEW.md` não existia. **Existia** — no
> repo de deploy, não no monorepo. Era a versão do 1º envio (5 permissões, justificativas em
> português). Dela foram aproveitados a tabela de URLs e o texto de data handling.

---

## 5. A pegadinha do deploy

O Eliab perguntou *"posso fazer deploy?"*. **Não podia.** Todo o trabalho estava no monorepo
`Veertex`; o Dokploy builda de `C:\HD\Eliab\ecoa`, parado no commit `e39d007` de 28/07. Deploy
naquele momento teria subido o código velho — com Campaigns, `business_management`,
`story_mention` e sem `instagram_manage_comments`.

**Sincronização feita cirurgicamente:** 35 arquivos copiados, 26 removidos, preservando o que é
específico do deploy. Uma cópia em bloco teria **apagado `/privacy` e `/data-deletion`** — as
páginas que a Meta exige.

**Validado no próprio repo de deploy:** `tsc` limpo, 20 testes passando, `next build` gerando
`/privacy`, `/data-deletion` e `/icon.png`, sem `/campaigns`.

**Commit local `cd25ee4` em `main`.**

---

## 6. Estado atual e pendências

### ECOA — ordem do deploy
1. **`git push`** do repo `C:\HD\Eliab\ecoa` (commit `cd25ee4`) — sem isso o Dokploy não vê nada.
2. Backup do banco.
3. Deploy do backend e do frontend (frontend com **Clean Cache**).
4. Rodar `03_detection_types.sql` e **depois** `02_drop_campaign.sql`.
   > A ordem importa: o `02` derruba `campaign_id` e o código antigo ainda a lê. Rode
   > `SELECT count(*) FROM detection;` antes — se der zero, o `03` é no-op.
5. **Reconectar a conta de teste** — o escopo do OAuth mudou; o token atual **não** tem
   `instagram_manage_comments`. Sem isso o webhook continua mudo.
6. Assinar o campo `mentions` no webhook e confirmar `POST /{ig-user-id}/subscribed_apps`.
7. Provocar uma **detecção real** (alguém republicar citando o `@` **na legenda**).
8. Gravar os **4 vídeos** (um por permissão) e enviar seguindo `docs/APP_REVIEW.md`.

### Pendências menores
- Página `/terms` (o campo na Meta ainda aponta para `facebook.com`).
- **Rotacionar a senha** da conta de teste (`Ecoa@2026`) — circulou em documento versionado.
- ESLint do frontend quebrado por config **pré-existente** (o `tsconfig` da raiz não inclui
  `apps/`). Por isso as verificações usaram `next build --no-lint`.
- Trocar as mensagens de exceção em inglês por códigos traduzidos no i18n.

### EMDR Remoto — pendências de segurança (do `HISTORICO_ClaudeIA.md`, não tratadas)
- **Rotacionar** a senha do banco `emdr`, a `EVOLUTION_API_KEY` global e a senha do
  psicólogo/admin de teste — todas circularam em chat/arquivo.
- Fechar as portas externas do banco (3307/3308), se ainda abertas.

---

## 7. Lições que custaram caro (não repetir)

**App Review da Meta**
- Nunca peça permissão que o código não chama. Custou `pages_read_engagement` (1ª rodada) e
  provavelmente `business_management` (2ª).
- Nunca descreva ao revisor uma funcionalidade cuja permissão você não pediu.
- A justificativa tem que descrever o comportamento **real**, inclusive leitura de perfis de
  terceiros.
- Vídeo **por permissão**, mostrando o diálogo de consentimento.
- Não deixe o revisor depender de uma conta Instagram própria.
- **Leia e transcreva o feedback** antes de mexer em qualquer coisa.

**Arquitetura / processo**
- **Confirme a doc da Meta ANTES de codificar.** O `ECOA_SPEC.md` mandava; ninguém fez; o produto
  foi construído sobre uma premissa falsa por meses.
- **Monorepo ≠ repo de deploy.** Verifique de onde o Dokploy builda antes de prometer deploy.
- Sincronização entre repos é **cirúrgica**, nunca cópia em bloco.
