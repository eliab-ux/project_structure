# Histórico das conversas com a IA — índice do monorepo

> Escrito em **25/08/2026**, antes de formatar a máquina. Existe para que nada do que foi
> decidido nestas semanas dependa de um disco.
>
> **Nenhum segredo aqui, nem nos arquivos que este índice aponta.** Senhas, chaves de API e
> strings de conexão que circularam no chat foram substituídas por marcadores. O valor não
> está no repositório de propósito: segredo commitado fica no histórico do git para sempre,
> mesmo depois de apagado do arquivo.

---

## 1. O que existe, e onde

### A transcrição completa

📁 **[`docs/historico-ia/`](./docs/historico-ia/)** — a conversa inteira, uma sessão por
arquivo, em ordem cronológica. São **9 sessões, 437 mensagens suas e 2.633 respostas**, de
**06/08/2026 a 25/08/2026**.

O que está lá é a conversa: o que foi pedido e o que foi respondido. Ficaram de fora as
chamadas de ferramenta e as saídas de comando — são ruído de execução, e é o que fazia as
transcrições cruas somarem ~130 MB.

| Arquivo | Sistema |
| --- | --- |
| `2026-08-06-f65c1c10.md` | GITVEERT / Veertex — leitura de requisitos e primeiros históricos |
| `2026-08-08-43472092.md` | **Batuta** — WhatsApp, Evolution API, entregabilidade, caixa de entrada |
| `2026-08-08-5575854a.md` | Plano Diário — recorte de histórico |
| `2026-08-08-c109b299.md` | **Ecoa** — recorte de histórico e a reprovação da Meta |
| `2026-08-08-b24599e6.md` | EMDR Remoto — recorte de histórico |
| `2026-08-08-c502f0db.md` | **Veertex ERP** — F1/F2, RLS, módulos, Mesa e o microfone |
| `2026-08-08-d2c096e1.md` | **Veertex ERP** — Mesa, LGPD, câmera, deploy no Dokploy |
| `2026-08-14-be23e9cb.md` | **Kortex** — venda de hora-máquina de corte (Fases 1 a 6 + deploy) |
| `2026-08-22-89ea3c46.md` | **Veertex ERP** — VND, EST, FIN, ROT, COB, app do representante |

### Os históricos curados, por sistema

Onde a transcrição é o registro bruto, estes arquivos são a leitura: o que foi decidido, por
quê, e o que ficou pendente.

| Sistema | Arquivo |
| --- | --- |
| **Kortex** — venda de hora-máquina de corte | [`apps/Kortex/HistoricoConversaIA.md`](./apps/Kortex/HistoricoConversaIA.md) |
| **Veertex** — ERP SaaS multi-tenant | [`apps/Veertex/HistoricoConversaIA.md`](./apps/Veertex/HistoricoConversaIA.md) |
| **Batuta** — disparo e atendimento por WhatsApp | [`apps/batuta-system/HISTORICO_ClaudeIA.md`](./apps/batuta-system/HISTORICO_ClaudeIA.md) |
| **EMDR Remoto** — sessões de EMDR à distância | [`apps/emdrremoto/HISTORICO_ClaudeIA.md`](./apps/emdrremoto/HISTORICO_ClaudeIA.md) |
| **Plano Diário** | [`apps/plano-diario/HISTORICO_ClaudeIA.md`](./apps/plano-diario/HISTORICO_ClaudeIA.md) |

E, na raiz, os históricos anteriores que já existiam: `HISTORICO_ClaudeIA.md`,
`HISTORICO_ClaudeIA-ECOA.md`, `HISTORICO_CHAT.md`, `RESUMO_CONVERSA.md`,
`RESUMO_CONVERSA-ECOA.md`.

---

## 2. Os sistemas do monorepo

| Pasta | Sistema | Estado |
| --- | --- | --- |
| `apps/Veertex` | ERP SaaS multi-tenant (CORE, VND, EST, FIN, ROT, COB, FIS) | Em construção ativa; deploy no Dokploy |
| `apps/Kortex` | Venda de hora-máquina de corte de tecido | Fases 1–6 fechadas; Fase 7 travada em dependência externa |
| `apps/batuta-system` | Disparo e atendimento por WhatsApp (Evolution API) | Em produção — `batuta.techbs.com.br` |
| `apps/ecoa-system` | Integração Instagram / Meta | Em produção — `ecoa.equipamentospsi.com` |
| `apps/emdrremoto` | Sessões de EMDR à distância (WebRTC) | `emdrremoto.com.br` |
| `apps/kaza-tem-system` | E-commerce / marketplace (Magis5, Bling) | Requisitos e base |
| `apps/plano-diario` | Plano diário | Base |
| `apps/tkc`, `apps/TKCCapital` | TKC Capital | Início |

Infra comum: **Dokploy** em `dokploy.mdantas.com.br`, IP `72.61.43.90`, DNS na Cloudflare,
Traefik + Let's Encrypt. O playbook de deploy está no `CLAUDE.md` da raiz.

---

## 3. O que **não** está no repositório — e precisa de backup separado

Antes de formatar, copie estes para um lugar seguro. Nenhum deles está no git, e por bons
motivos:

1. **`DADOS.txt`** (raiz do monorepo) — está no `.gitignore` porque tem senhas em texto puro
   (Bling, Supabase, GPT, Registro.BR). **Não vai para o GitHub.** O lugar dele é um
   gerenciador de senhas — Bitwarden, 1Password, KeePass — não um arquivo de texto e não um
   repositório.
2. **Os arquivos `.env`** de cada app — `apps/*/backend/.env`, `apps/*/frontend/.env.local`.
   São ignorados pelo git de propósito. Os valores de produção já estão na aba *Environment*
   de cada serviço no Dokploy, então o risco real é só o ambiente local.
3. **As transcrições cruas** em `%USERPROFILE%\.claude\projects\c--HD-Eliab-Veertex\` (~130 MB).
   A conversa já está preservada em `docs/historico-ia/`; o material cru só importa se você
   quiser reabrir uma sessão com o contexto de ferramentas intacto.
4. **Chaves SSH** em `%USERPROFILE%\.ssh\` — a chave pessoal que dá push no GitLab.

> Se alguma senha do `DADOS.txt` já circulou por chat, e-mail ou print, o certo é **rotacionar**,
> não guardar melhor. Vale principalmente para a senha do banco no Supabase.

---

## 4. Como retomar depois de formatar

```bash
git clone https://github.com/eliab-ux/project_structure C:\HD\Eliab\Veertex
cd C:\HD\Eliab\Veertex
npm install
```

Depois:

1. Recrie os `.env` a partir dos `.env.example` de cada app, com os valores do gerenciador de
   senhas e da aba Environment do Dokploy.
2. Restaure a chave SSH e confirme o push no GitLab (`git@gitlab.com:eliab1/veertex.git` e
   `git@gitlab.com:eliab1/kortex.git`).
3. Leia o `CLAUDE.md` da raiz — ele governa arquitetura, segurança e deploy de todos os apps.
4. Para retomar uma conversa com a IA, aponte-a para o histórico do sistema em questão:
   ele carrega as decisões e o motivo de cada uma.

---

## 5. Uma nota sobre o formato

Estes arquivos guardam **decisão com motivo**, não só resultado. É deliberado: decisão sem
motivo é revertida na primeira pressa, por alguém que olha o código, acha estranho e
"conserta" de volta para o errado.

Vários trechos preservam a sua frase original em vez de parafraseá-la — quando você diz
*"só pode aplicar a quantidade de matriz que tem no pedido"*, isso é a regra, e reescrevê-la
com outras palavras só abriria espaço para interpretação.
