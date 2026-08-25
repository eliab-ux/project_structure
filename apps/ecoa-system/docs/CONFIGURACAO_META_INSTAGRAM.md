# Configuração do App na Meta (Facebook) para integrar com o Instagram

Guia para conectar o **Ecoa** à conta do Instagram via **Instagram API com Facebook Login**
— que é exatamente o fluxo que o backend implementa (`InstagramGraphGateway`):
`dialog/oauth` → token → `/me/accounts` → `instagram_business_account` → mídias/insights/menções.

> ⚠️ **A Meta muda nomes de escopos, produtos e regras de App Review com frequência.** Este guia
> foi conferido na doc oficial vigente (jul/2026), mas **confirme cada nome no App Dashboard** ao
> configurar. Se algo divergir, o ponto de ajuste no código é só o `InstagramGraphGateway`
> (`backend/src/infrastructure/integrations/instagram/instagram-graph.gateway.ts`) — nada mais muda.

---

## 0. Pré-requisitos da conta (obrigatório)

Sem isto, a API **não** funciona (limitação da plataforma, não do Ecoa):

1. Conta Instagram **Business** ou **Creator** (conta pessoal **não** acessa insights/webhooks).
2. Essa conta **vinculada a uma Página do Facebook** (as permissões fluem pela Página).
3. Uma conta de **desenvolvedor** na [Meta for Developers](https://developers.facebook.com/) com
   permissão de administrar essa Página.
4. Para o **webhook** em desenvolvimento: um **endpoint HTTPS público** apontando para a sua
   máquina (ex.: túnel `ngrok`/`cloudflared` → `http://localhost:3001`). Meta não entrega webhook em `http://localhost`.

Como vincular IG ↔ Página: no app do Instagram → *Configurações → Conta → Central de Contas*,
ou pela Página no Facebook → *Configurações → Contas vinculadas*.

---

## 1. Criar o app na Meta

1. [developers.facebook.com](https://developers.facebook.com/) → **Meus Apps → Criar App**.
2. Tipo: **Empresa (Business)**.
3. Anote o **App ID** e o **App Secret** (*Configurações → Básico*) → vão para o `.env`:
   - `META_APP_ID`
   - `META_APP_SECRET`

---

## 2. Adicionar os produtos

No painel do app (**Adicionar produto**):

| Produto | Para quê |
|---|---|
| **Facebook Login** (ou *Facebook Login for Business*) | Fluxo OAuth que o Ecoa usa (`dialog/oauth`). |
| **Instagram Graph API** | Fica acessível automaticamente com o Facebook Login configurado; é o que lê mídias, insights e o `/me/accounts`. |

### Configurar o Facebook Login

Em **Facebook Login → Configurações → Valid OAuth Redirect URIs**, adicione **exatamente** a URL
que está no `.env` em `META_OAUTH_REDIRECT_URI`:

- **Desenvolvimento:** `http://localhost:3003/connection/callback`
- **Produção:** `https://SEU_DOMINIO/connection/callback`

> O redirect aponta para a **página do frontend** (`/connection/callback`), que recebe o `code` e
> o envia para o backend em `POST /api/connection/callback`. A URL cadastrada na Meta tem que ser
> **idêntica** (mesma barra, mesmo host/porta) à do `.env`, senão o OAuth falha com "URL blocked".

---

## 3. Permissões / escopos

O `InstagramGraphGateway` pede estes escopos no OAuth (confirme os nomes no Dashboard):

| Escopo | Uso no Ecoa |
|---|---|
| `instagram_basic` | Ler perfil e mídias da conta IG. |
| `instagram_manage_insights` | Ler alcance/salvamentos/compartilhamentos dos posts. |
| `pages_show_list` | Listar as Páginas do usuário (`/me/accounts`). |

> Mínimo absoluto para "descobrir a conta IG": `instagram_basic` + `pages_show_list`.
>
> **Removidos — não peça de volta sem uma chamada que os use:**
> - `pages_read_engagement` — reprovado na 1ª rodada de App Review. O Ecoa nunca lê
>   posts/engajamento de Página do Facebook.
> - `business_management` — removido na 3ª rodada. A justificativa alegava acesso a ativos do
>   Business Manager, mas as únicas chamadas feitas são `/me/accounts` e
>   `/{page-id}?fields=instagram_business_account`, ambas cobertas por `pages_show_list`.
>

| `instagram_manage_comments` | Webhook `mentions` + edge `/tags` — é o que habilita o Detections. Uso **somente leitura**: o Ecoa nunca publica, responde nem modera comentário. |

> ⚠️ **Story reshare não é detectável.** A doc da Meta diz *"Mentions on Stories are not
> supported"*. O campo `mentions` cobre menção em **legenda** ou **comentário**; `/tags` cobre
> **marcação**. Story mention só existe pela Instagram **Messaging** API
> (`instagram_manage_messages`), outro produto e outra trilha de review.

---

## 4. Webhook de menções

O Ecoa recebe reposts/menções em `POST /api/webhooks/instagram` (com handshake `GET`).

Em **Instagram Graph API → Webhooks** (ou *Produto Webhooks* → objeto **`instagram`**):

1. **Callback URL:**
   - Dev (com túnel): `https://SEU_TUNEL.ngrok.io/api/webhooks/instagram`
   - Prod: `https://SEU_DOMINIO/api/webhooks/instagram`
2. **Verify Token:** o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN` no `.env`.
   - A Meta faz um `GET` com `hub.mode`, `hub.verify_token`, `hub.challenge`; o Ecoa valida o token
     e devolve o `challenge`. Token errado → `403` (comportamento correto).
3. Após "Verificar e salvar", **assine o campo `mentions`** (menções/@ em posts e stories).
   - Se aparecerem também `comments`, `story_insights` etc., assine apenas o que for usar (`mentions`).
4. **Assinatura dos eventos:** todo `POST` traz `X-Hub-Signature-256` (HMAC-SHA256 do corpo cru com o
   **App Secret**). O Ecoa recusa payload sem assinatura válida — por isso o `META_APP_SECRET` no `.env`
   precisa ser o do mesmo app.

> **Latência/limite da Opção A:** o webhook de `mentions` só dispara quando **o seu `@` é preservado**
> (ex.: compartilhar no story marcando o perfil). Reshare sem `@`, print re-upado ou DM **não** geram
> evento — isso está documentado na UI e é esperado.

---

## 5. Testar em desenvolvimento (antes do App Review)

Enquanto o app está em **modo de desenvolvimento**, só contas com papel no app conseguem autorizar:

1. **App Roles → Roles:** adicione a si mesmo como *Administrador/Desenvolvedor/Testador*.
2. Garanta que a **conta IG de teste** (Business/Creator) pertence a você e está vinculada à Página.
3. No Ecoa: *Conexão → Conectar Instagram* → autorize os escopos → o token é trocado, **criptografado
   (AES-256-GCM)** e salvo. O job `refresh-token` passa a renovar sozinho.

> Para o webhook funcionar fora do sandbox e os insights valerem para **outras** contas, é preciso
> **App Review aprovado** dos escopos acima (item 7).

---

## 6. Mapa `.env` → Meta

| Variável (`backend/.env`) | Onde obter na Meta |
|---|---|
| `META_APP_ID` | Configurações → Básico → ID do app |
| `META_APP_SECRET` | Configurações → Básico → Chave secreta |
| `META_OAUTH_REDIRECT_URI` | = "Valid OAuth Redirect URIs" do Facebook Login (idêntico) |
| `META_WEBHOOK_VERIFY_TOKEN` | valor que você define e repete no cadastro do Webhook |
| `META_GRAPH_API_VERSION` | versão da Graph API que você mira (ex.: `v21.0`) — confira a mais nova estável |

---

## 7. App Review (para produção / outros usuários)

Necessário para o webhook de `mentions` sair do sandbox e para insights valerem em contas de terceiros:

> ⚠️ **Duas reprovações já aconteceram.** Antes de montar qualquer envio, leia
> `docs/APP_REVIEW.md` — ele traz o que a Meta recusou, por quê, e o texto exato de cada
> justificativa. As regras que custaram caro: **nunca peça permissão que o código não chama**
> e **nunca descreva ao revisor uma funcionalidade cuja permissão você não pediu**.

1. **App Review → Permissions and Features:** solicite `instagram_basic`,
   `instagram_manage_insights`, `pages_show_list` e `instagram_manage_comments` — quatro, nem
   mais nem menos.
2. Grave um **screencast por permissão**, mostrando a tela de consentimento do Facebook com as
   permissões sendo concedidas — um vídeo genérico para todas já foi reprovado.
3. Preencha **Política de Privacidade** e descrição de uso de dados.
4. Publique o app (**modo Live**) após aprovação.

Enquanto isso não conclui, desenvolva contra a conta de teste — os pontos de integração já estão
isolados atrás do `InstagramGatewayPort`, então nada precisa ser refatorado depois.

---

## Fontes (doc oficial Meta, conferida jul/2026)

- [Instagram API with Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login)
- [Instagram API with Facebook Login — Get Started](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started)
- [Instagram Platform — Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks)
- [Instagram Platform — Overview](https://developers.facebook.com/docs/instagram-platform/overview/)
