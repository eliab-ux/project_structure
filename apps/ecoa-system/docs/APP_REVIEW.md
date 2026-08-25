# App Review da Meta — Ecoa (app ID `2047002089570738`)

> **Textos prontos para copiar no formulário da Meta.** Este documento é o 3º envio.
> Os blocos em `código` vão **em inglês**, exatamente como estão — o app é declarado em inglês.
> A explicação em volta é para você, não vai para a Meta.

---

## 0. URLs do app (Configurações → Básico)

| Campo | Valor |
|---|---|
| URL do site / App | `https://ecoa.equipamentospsi.com` |
| **Política de Privacidade** | `https://ecoa.equipamentospsi.com/privacy` |
| **Instruções de exclusão de dados** | `https://ecoa.equipamentospsi.com/data-deletion` |
| Redirect OAuth (Facebook Login) | `https://ecoa.equipamentospsi.com/connection/callback` |
| Webhook (`instagram` → campo `mentions`) | `https://ecoa.equipamentospsi.com/api/webhooks/instagram` |
| E-mail de contato | `suporte@equipamentospsi.com` |
| Termos de Serviço | ⚠️ ainda aponta para `facebook.com` — criar `/terms` |

---

## 0.1. Por que já reprovou duas vezes

| Envio | Resultado | Motivos |
|---|---|---|
| 1º — 07/07/2026 | Reprovado em 28/07 | UI não estava em inglês · screencast não mostrava o fluxo completo · `instagram_manage_insights` sem métrica real (reach zerado) · `pages_read_engagement` julgada desnecessária |
| 2º — 28/07/2026 | Reprovado (visto em 10/08) | As 4 permissões `Not approved`, sem aprovação parcial |

**As três regras que essas reprovações ensinaram — não viole nenhuma:**

1. **Nunca peça permissão que o código não chama.** Custou `pages_read_engagement` no 1º envio
   e, quase certamente, `business_management` no 2º.
2. **Nunca descreva ao revisor uma funcionalidade cuja permissão você não pediu.** O 2º envio
   mandou o revisor abrir "Detections" (webhook `mentions`) sem pedir
   `instagram_manage_comments` — não tinha como funcionar.
3. **A justificativa tem que descrever o comportamento real**, inclusive leitura de perfis de
   terceiros. O 2º envio dizia "shown only to the owner" enquanto o código chamava
   `business_discovery` em contas alheias.

> ⚠️ **Story reshare está fora de alcance.** A doc oficial diz *"Mentions on Stories are not
> supported"*. O produto foi redefinido para o que a API entrega: menção na **legenda**, menção
> em **comentário** e **marcação**. Não prometa story em lugar nenhum do envio.

---

## 1. Permissões do 3º envio

Quatro permissões. Cada uma abaixo lista **a chamada exata** que a exige — se algum dia uma
delas ficar sem chamada, tire do pedido.

| Permissão | Chamada que a exige |
|---|---|
| `instagram_basic` | `/{ig-user-id}/media`, `/{ig-media-id}`, `/{page-id}?fields=instagram_business_account` |
| `instagram_manage_insights` | `/{ig-media-id}/insights`, `business_discovery` |
| `pages_show_list` | `/me/accounts` |
| `instagram_manage_comments` | webhook `mentions`, `/{ig-user-id}/tags` |

**Removidas de propósito — não devolva ao pedido:** `pages_read_engagement` (o app nunca lê
posts/engajamento de Página) e `business_management` (as únicas chamadas feitas já são cobertas
por `pages_show_list`).

---

## 2. "Tell us how you're using this permission or feature"

### `instagram_basic`

```
Ecoa reads the profile and published media of the Instagram professional account that the
user connects: the username and account id, and for each post its id, permalink, media type,
caption, thumbnail and timestamp. These posts are listed in the user's own dashboard under
"My media", and opening one shows how its metrics evolve over time.

Together with instagram_manage_insights, it is also used for the business_discovery lookup
described below, which resolves a public @handle the user typed into their watchlist to its
account id.

A user only ever sees data from the account they themselves authorized. Ecoa is multi-tenant
and every read is scoped to the owner of the connection.
```

### `instagram_manage_insights`

```
Ecoa reads media insights for the connected account's own posts - reach, saved and shares -
and stores a time series so the user can see how each post performs over the days after
publishing. The metrics are displayed as a chart on the media detail page and aggregated on
the Overview page.

This permission also enables the business_discovery field. When a user adds a public @handle
to their watchlist, Ecoa resolves that handle to an account id through
GET /{ig-user-id}?fields=business_discovery.username(HANDLE){id}, so that reshares coming from
that account can be highlighted in the user's feed. Only the public id of that account is
read and stored; no media or metrics of third-party accounts are collected.

Insights are shown only to the owner of the account that authorized the app.
```

> ☝️ O parágrafo do `business_discovery` é a correção do achado mais sério da auditoria. Não o
> remova para "simplificar" — foi a omissão dele que fez a justificativa anterior divergir do
> código.

### `pages_show_list`

```
Ecoa calls GET /me/accounts to list the Facebook Pages the user manages, and then reads the
instagram_business_account field of each Page to find the Instagram professional account
linked to it. This is the only supported way to obtain the ig_user_id that every other call
in the app depends on, so it runs once, right after the user authorizes the connection.

Ecoa does not read Page posts, Page engagement or any Page content. Only the Page id and the
linked Instagram account id and username are used.
```

### `instagram_manage_comments`

```
Ecoa subscribes to the "mentions" webhook field and reads the /{ig-user-id}/tags edge to
detect when someone reposts the user's content while preserving their @. Three signals are
covered: an @mention in the caption of another account's post, an @mention in a comment, and
a tag. Each detection becomes a card in the user's "Detections" feed showing which account
reshared and when, and detections from accounts on the user's watchlist are highlighted.

This is the core purpose of the product: a creator connects their account to find out who is
resharing their posts.

Ecoa uses this permission strictly read-only. It never publishes, replies to, hides, deletes
or moderates comments. The tags edge is also re-read periodically as a safety net in case a
webhook delivery is lost.
```

---

## 3. "Web reviewer instructions"

> 🔴 **Pré-requisito seu antes de enviar:** a conta de teste tem que estar **já conectada** a
> uma conta Instagram profissional, e tem que haver **pelo menos uma detecção real** no feed.
> O 2º envio exigia que o revisor trouxesse a própria conta Instagram — se ele não tem uma
> vinculada a uma Página, o fluxo morre no diálogo do Facebook, e reprovação em bloco das
> quatro permissões (sem nenhuma aprovação parcial) é exatamente a assinatura disso.
>
> Para gerar a detecção: publique um post na conta de teste, peça a alguém para republicar a
> imagem citando o `@` da conta **na legenda** (ou marcar a conta no post). Em modo Development
> a permissão já funciona para quem tem cargo no app, então isso é possível **antes** da
> aprovação.

```
Open https://ecoa.equipamentospsi.com and sign in with the test account:

  email: eliab@techbs.com.br
  password: <SENHA>

The UI is in English by default; a language switcher is available in the top bar.

The test account is already connected to an Instagram professional account, so you can review
every screen without linking an account of your own. If you prefer to see the connection flow
itself, step 5 explains how.

1. "My media" lists the posts synced from the connected Instagram account - permalink,
   caption, thumbnail and publish date. (instagram_basic)

2. Open any post. The chart shows how its metrics evolved across captures: reach, likes,
   comments, saved and shares. (instagram_manage_insights)

3. "Detections" is the core feature. It lists the accounts that reshared this account's
   content while preserving its @ - as a caption mention, a comment mention, or a tag. These
   arrive through the "mentions" webhook and the /tags edge.
   (instagram_manage_comments)

4. "Watchlist" is where the user adds public @handles to follow. Ecoa resolves each handle to
   an account id through the business_discovery field, so detections coming from those
   accounts are highlighted in the feed at step 3.
   (instagram_basic + instagram_manage_insights)

5. To see the authorization flow, go to "Connection" and click "Connect Instagram". The
   Facebook Login dialog lists the four permissions being requested. Authorizing requires an
   Instagram Business or Creator account linked to a Facebook Page. Right after authorization
   Ecoa calls /me/accounts to find the Page and its linked Instagram account
   (pages_show_list), then immediately syncs media and captures insights.

Note on where each permission appears: instagram_basic and instagram_manage_insights are
visible in steps 1, 2 and 4; instagram_manage_comments in step 3; pages_show_list runs
server-side during step 5 - the connection succeeding and the media loading is what
demonstrates it.
```

> A senha real **não fica neste arquivo** (regra de secrets do CLAUDE.md). Troque `<SENHA>` na
> hora de colar no formulário. E **rotacione essa senha** depois da aprovação — ela já circulou
> em documento versionado.

---

## 4. Vídeo — um por permissão

O 2º envio anexou **um único vídeo** para as quatro permissões e ainda declarava que duas
"are not shown directly in the UI". Isso é admitir que não há demonstração. Grave **quatro
trechos**, cada um começando pelo login e mostrando o **diálogo de consentimento do Facebook
com as permissões sendo concedidas**.

| Permissão | O que o vídeo precisa mostrar |
|---|---|
| `instagram_basic` | Consentimento → "My media" com posts reais carregados (thumbnail, legenda, data) |
| `instagram_manage_insights` | Abrir um post → gráfico com **números reais** (reach ≠ 0). Foi reprovado antes justamente por reach zerado |
| `pages_show_list` | O fluxo "Connect Instagram" completando e o app exibindo "connected as @…" — é a prova server-side |
| `instagram_manage_comments` | "Detections" com **pelo menos uma detecção real**, mostrando de qual conta veio e o link do post |

Regras: UI em inglês, sem cortes entre o consentimento e o resultado, e nada de tela em branco
ou estado vazio na permissão que está sendo demonstrada.

---

## 5. Data handling (repetir o que já passou)

Estas respostas não foram objeto de reprovação — mantenha idênticas:

- **Data processors:** `Yes` → **Supabase** → categoria *IT solutions and services, including
  cloud storage and processing* → país *Estados Unidos da América*.
- **Responsável pelos dados:** `OTEC ORGANIZACAO TECNICA DE CADASTROS LTDA`, país `Brazil`
  (CNPJ 02.237.162/0001-73 — verificação de negócio **aprovada em 02/07/2026**).
- **Pedidos de autoridades públicas nos últimos 12 meses:** `No`.
- **Políticas sobre pedidos de autoridades:** marcar as quatro (contestação de pedidos ilegais,
  minimização de dados, documentação dos pedidos, revisão de legalidade).
- **Is Facebook Login integrated on this platform?** `Yes`.

Se aparecer um campo livre de "como o app trata os dados", este texto já passou nas rodadas
anteriores:

```
Ecoa only collects data from the account the user explicitly authorizes, through Meta's
official API. The data is used exclusively to show that same user their own posts, metrics and
reshares inside the Ecoa dashboard. We do not sell data and we do not share it with third
parties for advertising. The access token is encrypted at rest (AES-256-GCM) and used only
server-side. A user can disconnect the account at any time, which revokes the token, or
request full deletion of their data.
```

---

## 6. Checklist antes de clicar em enviar

- [ ] Conta de teste **já conectada** a uma conta Instagram profissional
- [ ] **Pelo menos uma detecção real** visível em "Detections"
- [ ] Reach com **número real** (≠ 0) no detalhe de algum post
- [ ] Quatro vídeos, um por permissão, cada um mostrando o consentimento
- [ ] Pedido com **exatamente 4** permissões — sem `pages_read_engagement`, sem
      `business_management`
- [ ] Nenhuma menção a **story** em texto, vídeo ou instrução
- [ ] `<SENHA>` substituída pela senha real no formulário
- [ ] UI em inglês em todas as telas do vídeo (inclusive mensagens de erro)
- [ ] Páginas `/privacy` e `/data-deletion` no ar

---

## 7. Se reprovar de novo

Leia o feedback em **"Acessar o feedback do envio" → "Ver detalhes da solicitação"** e cole o
texto **literal** aqui embaixo antes de mexer em qualquer coisa. As duas primeiras reprovações
foram tratadas por hipótese porque o feedback nunca foi transcrito — não repita isso.

### Feedback do 2º envio (28/07 → reprovado)
_(não transcrito — se ainda estiver acessível no painel, cole aqui)_
