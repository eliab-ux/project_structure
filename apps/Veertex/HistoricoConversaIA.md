# Histórico de conversas com a IA — Veertex

> Registro do que foi **decidido**, **construído** e **aprendido** nas sessões de desenvolvimento
> assistido. Escrito em 24/08/2026, antes da formatação da máquina do Eliab.
>
> ⚠️ **Nenhum segredo aqui.** Senhas, chaves e connection strings que circularam nas conversas foram
> deliberadamente omitidas — este arquivo é versionado. O que precisa ser preservado delas está no
> `.env` local (não versionado) e na aba Environment do Dokploy.
>
> Este arquivo **não substitui** o que já está registrado em código e ADRs. Ele existe para preservar
> o **encadeamento**: por que uma decisão veio antes da outra, e o que uma correção ensinou. Onde há
> documento próprio, ele é citado — o documento é a fonte, este é o índice narrativo.

---

## 1. O que o Veertex é, em três linhas

ERP SaaS multi-tenant para pequenas e médias empresas brasileiras. Arquitetura hexagonal, NestJS +
Fastify no backend, Next.js 14 + MUI no frontend, PostgreSQL self-hosted com **Row Level Security** e
**dois papéis de banco** (`veertex_owner` com DDL, `veertex_app` sem).

O que o produto É vive em `Requisitos/00_Veertex_Visao_Geral.md` e `01_Veertex_Core.md`. Como se
escreve o código vive no `CLAUDE.md`.

---

## 2. Linha do tempo das decisões grandes

### 10–13/08 — o código volta para o monorepo

O Veertex tinha sido extraído para repositório próprio e voltou para `apps/Veertex/` dentro do
`project_structure`. Ficou com **cópia própria** dos pacotes compartilhados, sob escopo `@veertex/*`
(ADR-0002).

**O que se aprendeu na ida e volta do escopo:** o que resolve um import de workspace é o **symlink
que o npm cria a partir do campo `name`**, não os `paths` do `tsconfig`. Um `tsconfig` filho que
declara `paths` **substitui** os da base por completo.

### 14/08 — a fatia de Contato (§3.4)

Cadastro único com tipos múltiplos (cliente/fornecedor/transportadora/revendedor). Decisões do Eliab
registradas no código:

- **documento único por conta** (default conservador: dois cadastros com o mesmo CNPJ é o começo de
  duas verdades sobre o mesmo cliente);
- **numeração manual** (sequencial exige contador por tenant — design próprio);
- **carteirização fora por inteiro, nem o campo**. O motivo é a regra que se repetiu depois em toda
  parte: *"coluna existindo sem o filtro é a pior configuração, porque alguém depois supõe que ela
  restringe algo"*;
- **limite de crédito guarda valor e a TELA diz que não bloqueia** — o aviso viaja no `hint` do
  catálogo de campos e some sozinho quando o VND existir.

### 15/08 — captura de voz e imagem

**Microfone on-device** (Web Speech com `processLocally: true`), com três regras inegociáveis: nada
sai da máquina, `available()` diferente de `available` faz o microfone **não aparecer** (ausência, não
botão cinza), e **nunca há fallback para nuvem**.

**Imagem de documento** (ADR-0006): processa e descarta, campos lidos nascem com `origin: 'externo'` e
`review: true` **impostos pelo código** (não pedidos ao modelo), e o backend **recusa** sem o registro
de que o aviso ao titular foi exibido.

O caminho de **áudio para o Gemini** foi construído e ficou **parado e desligado**
(`AUDIO_TRANSCRIPTION_ENABLED=false`) — ADR-0005.

### 18/08 — a reversão dos pacotes copiados

Eliab: *"todos são publicados igual, o Veertex vai ser, e nenhum copiou o pacote. Por que só o
Veertex tem que ter? Não aceito."*

Medido antes de aceitar, e ele estava certo: a anomalia não era a pasta, era o **esquema de publicação
por subtree**, herdado de quando o Veertex era repositório separado. E a divergência que o ADR-0002
previu **já havia acontecido** — `validation.util.ts` com 87 linhas na raiz e 35 na cópia, em cinco
dias, sem ninguém notar.

Resultado: 83 arquivos de volta para `@gitspread/*`, pacotes só na raiz, Dockerfiles no formato dos
outros apps, e a publicação passou a ser **espelho de conteúdo**
(`apps/Veertex/deploy/publish-mirror.sh`, o mesmo mecanismo do Kortex).

### 19/08 — a fatia de Produto (§3.5)

Recorte aprovado com três ajustes do Eliab. O mais importante derrubou a minha proposta:

> **Kit fica fora por inteiro — nem a composição.** *"O limite de crédito é um número que alguém
> consulta; o kit é estrutura de venda cujo sentido é baixar componente ao vender. Sem EST, o usuário
> monta a composição, vende, e nada se move no estoque — não é campo inerte, é comportamento errado
> silencioso."*

Os outros dois: **categoria em texto provisório** com o nome da coluna escolhido para a migração
(`category_path`, não `category`), e **unidade em lista fechada**.

Também de 19/08, o **widget de completude**: a tela diz *"Campos fiscais preenchidos"*, **nunca**
*"pronto para emissão fiscal"* — a primeira fala do cadastro, a segunda afirmaria que o sistema emite
nota, o que é falso sem o módulo FIS.

### 20–24/08 — o primeiro deploy

Publicação do espelho no GitLab, build das duas imagens localmente antes de publicar (foi o que pegou
o defeito do frontend), runbook em `backend/deploy/README.md §5` para `veertex.techbs.com.br`.

---

## 3. As seis regras aprendidas com defeito real

Estão no `CLAUDE.md`, seção *"Regras aprendidas com defeito real"*, com o caso completo de cada uma.
Resumo do que elas protegem:

| # | Regra | O defeito que a originou |
|---|---|---|
| 1 | Adapter de teste nunca é fallback de produção, e nunca diverge dele | o determinístico transformava pergunta em comando de escrita; a suíte usava ele e mentia sobre produção |
| 2 | Guarda segura demais rebaixa o óbvio, e recurso abandonado protege zero | a citação literal rebaixava permissão concedida em letras |
| 3 | Teste que falha por motivo alheio ensina a ignorar vermelho | 14 → 4 → 0 falhas na mesma árvore. **Limite: "era da máquina" vale duas vezes** |
| 4 | Número não medido não entra em documento como medido | tabela "Medido" com duas das três linhas vindas de texto de mensagem |
| 5 | Instrução ambígua contra regra registrada: a leitura que avança é a errada | troquei voz on-device por envio ao Gemini sem reabrir a decisão que eu mesmo havia registrado |
| 6 | Instrumento de medição precisa de teste próprio antes de produzir número | a página do microfone produziu **três vezes** o defeito que existia para detectar |

---

## 4. Os defeitos que a verificação encontrou, e o que cada um ensinou

Esta seção existe porque o padrão se repetiu: **rodar** encontrou o que typecheck, lint e revisão não
encontravam.

**A página de medição do microfone, três vezes.** Acumulação duplicando segmento; oito frases numa
execução pontuadas contra a frase 1; e `"desativar".includes("ativar")` descartando uma execução
válida — além de `"cobre".includes("cob")` contando a sigla COB como exata. **Dois dos três erros
eram otimistas**, e erro otimista não gera reclamação: ninguém investiga um número bom.

**O build do frontend só falhava no container.** `next build` roda ESLint, o ESLint usa o plugin do
prettier, e o `.prettierrc` não entrava na imagem — sem ele o prettier volta a aspas duplas e reprova
o app inteiro. Corrigido na causa (o arquivo entra na imagem), não desligando o lint.

**`DATABASE_URL` sem `postgresql://` passava pela validação.** `new URL('host:5432/banco')` não lança
— o parser lê `host:` como esquema. Ia morrer fundo no driver. Encontrado escrevendo o teste da
mensagem de erro, que também achou um segundo defeito: a ordem do diagnóstico respondia a coisa
errada para `DATABASE_URL=postgresql://…`.

**A verificação de isolamento não olhava para quem conecta.** Todas as checagens liam os papéis **pelo
nome**; a aplicação podia conectar como `postgres` e o boot imprimia "isolamento íntegro" com o RLS
inerte. Corrigido com `verifyRuntimeIdentity`, que pergunta à conexão: `current_user`,
`is_superuser`, `rolbypassrls`.

**E essa correção quebrou 97 testes.** Os CLIs de operador conectam como owner **de propósito** — o
onboarding escreve para um tenant que ainda não existe e o RLS recusaria. A checagem estava certa para
o processo que atende requisição e errada para o de operador. A marca `VEERTEX_OPERATOR_CLI` vive no
mesmo arquivo que causa a condição, e o pulo é **registrado no log**.

> A lição transversal: **commitar verificação sem tê-la visto passar cobra no dia seguinte.** A
> checagem de runtime foi commitada com a suíte pendente (Docker local caído), e a dívida apareceu com
> 97 vermelhos.

---

## 5. Decisões datadas — com gatilho de revisão

| Decisão | Data | Gatilho de revisão |
|---|---|---|
| `AUTO_MIGRATE=true` | 09/08 | antes do primeiro cliente em produção |
| Senha provisória dos papéis do banco | 20/08 | antes do primeiro cliente, **ou** antes de reabrir a porta externa do Postgres |
| Chave do Gemini compartilhada com o SpreadGuard | 15/08 | quando o Veertex tiver cliente em produção |
| Credencial **root** do MinIO usada pelo backend | 23/08 | criar access key escopada ao bucket `veertex-evidence` |

Todas estão escritas nos documentos correspondentes (`backend/deploy/README.md`,
`Requisitos/DEPENDENCIAS_EXTERNAS.md`) — a tabela aqui é índice.

---

## 6. O que está deliberadamente FORA, e volta quando

| O que | Volta com |
|---|---|
| Kit / composição de produto | módulo EST |
| Variações de produto | módulo CAN |
| Carteirização de contato | módulo VND/ROT |
| CFOP e herança de grupo fiscal | módulo FIS |
| Saldo e custo médio | módulo EST |
| Tabela de preço | módulo de preços |
| Árvore de categorias | fatia própria (hoje é `category_path` em texto) |
| Geocodificação | exige BullMQ + Redis (dependências novas) |
| Trilha de auditoria | ADR-0004 |
| VEXGuard (monitoramento) | ferramenta própria, ainda não existe |
| Caminho de áudio para transcrição | ADR-0005 — parado e desligado |

---

## 7. Estado do deploy em 24/08/2026

**Feito:** código no GitLab (espelho de conteúdo), as duas imagens buildam com o contexto do Dokploy,
runbook escrito, project `Veertex e Kortex` com Postgres e MinIO criados.

**Pendente:**

1. provisionar os papéis `veertex_owner`/`veertex_app` no Postgres do Dokploy — **é o que trava o
   boot**;
2. `DATABASE_URL` e `DATABASE_URL_MIGRATIONS` com os papéis certos (nunca `postgres`);
3. DNS `veertex` → `72.61.43.90`, **nuvem cinza** na Cloudflare;
4. fechar a External Port do Postgres;
5. rede do MinIO: ele está em rede isolada (`external: true`) — teste
   `getent hosts <container-do-minio>` de dentro do backend.

**Último erro observado (24/08):** `GET /api/products` respondendo 500 com
`Unhandled exception` no `GlobalExceptionFilter`, em `veertex.kortex.ind.br`. **Não investigado** — o
log mostrado não trazia a exceção original, só o 500 genérico que o filtro devolve ao cliente. O
detalhe está no log interno, na linha imediatamente anterior.

---

## 8. Decisões abertas, esperando o Eliab

- **Microfone, opção B:** `available()` é mascarado por origem — medido em 19/08, `localhost:3099`
  respondia `available` e `localhost:3021` respondia `downloadable`, e `install()` desmascara. Sem
  tratar, o microfone nasce invisível em **toda origem nova**, produção inclusive. Muda a regra 2, que
  é do Eliab;
- **Produto:** itens por caixa e DUN-14 estão no backend e fora da tela; tags existem na API e não têm
  editor; unidades de serviço não são filtradas por tipo de item;
- **Medição do microfone:** a rodada de 19/08 deu 100% em início, verbo e negação, mas com **n=1 por
  frase e só o modo `direto`**. As dez repetições nos três modos não foram feitas — sem elas não se
  distingue "o defeito era do instrumento" de "era intermitente".

---

## 9. Onde procurar cada coisa

| Assunto | Arquivo |
|---|---|
| Como se escreve código aqui | `apps/Veertex/CLAUDE.md` |
| O que o produto é | `Requisitos/00_Veertex_Visao_Geral.md`, `01_Veertex_Core.md` |
| Módulos no JWT | `Requisitos/ADR-0001_Modulos_no_JWT.md` |
| Pacotes copiados (e a reversão) | `Requisitos/ADR-0002_Pacotes_Copiados.md` |
| Estratégia de testes | `Requisitos/ADR-0003_...md` |
| Registro no caminho de falha | `Requisitos/ADR-0004_...md` |
| Captura de voz | `Requisitos/ADR-0005_Captura_de_Voz.md` |
| Imagem de documento | `Requisitos/ADR-0006_Imagem_de_Documento.md` |
| Dependências externas e medições | `Requisitos/DEPENDENCIAS_EXTERNAS.md` |
| Deploy e runbook | `apps/Veertex/backend/deploy/README.md` |
| Fila de verificação em produção | `apps/Veertex/backend/deploy/verify/README.md` |
| Publicação do espelho | `apps/Veertex/deploy/publish-mirror.sh` |

---

## 10. Arquivos com credencial que NÃO foram para o git

Na varredura de 24/08, três arquivos soltos na raiz do monorepo carregavam senha em texto claro e
foram **excluídos do versionamento** (entraram no `.gitignore`):

- `DADOS.txt` — credenciais de contas (e-mail, Bling, Supabase);
- `HISTORICO_ClaudeIA.md` — senha real de banco do EMDR Remoto e senha de usuário de teste;
- `HISTORICO_ClaudeIA-ECOA.md` — senha de login de teste do Ecoa.

⚠️ **Eles não estão no GitHub e serão perdidos na formatação se não forem copiados à parte.** O lugar
deles é um gerenciador de senhas ou um arquivo cifrado — não um repositório, mesmo privado: o que
entra no histórico do git não sai mais.

Os próprios arquivos recomendam rotacionar as credenciais que circularam. Vale fazer antes de
descartá-los.

### ⚠️ Uma senha ESCAPOU no commit `84b88cb`, e já foi empurrada

Na varredura eu procurei por *padrões* (`postgres://user:senha@`, `senha: X`, `AIza…`) e não pelos
**valores conhecidos**. A senha do banco do EMDR Remoto estava citada dentro de uma transcrição em
`docs/historico-ia/2026-08-08-b24599e6.md`, numa frase que avisava que ela era uma senha — formato que
nenhum dos meus padrões pegava.

O trecho foi redigido no commit seguinte, **mas isso não desfaz nada**: ela está no histórico do
`84b88cb`, que foi para o GitHub. Quem clonar o repositório a recupera com um `git log -p`.

**A remediação é rotacionar a senha do banco do EMDR Remoto.** Reescrever o histórico é possível
(`git filter-repo`), mas não devolve o segredo — quem já clonou continua com ele, e a credencial deve
ser tratada como comprometida de qualquer forma. Nota: o próprio `HISTORICO_ClaudeIA.md` já pedia essa
rotação desde antes, porque a senha "circulou no chat".

**A lição, para a próxima varredura:** procurar por padrão encontra o segredo em forma canônica;
procurar pelos **valores que você sabe que existem** encontra o segredo citado em prosa. As duas
buscas são necessárias, e a segunda é a que eu pulei.
