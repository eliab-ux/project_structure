# 01A_Veertex_Core_Pendencias.md — CORE: o que falta especificar

> **Complementa** `01_Veertex_Core.md` (baselinado). Não o substitui e não o contradiz.
> **Origem de cada item:** o §3.x do CORE que o pede, ou a decisão de sessão que o adiou.
> **Regra:** item marcado como ⚠️ DECISÃO não tem resposta nas fontes. Não preencher com
> default silencioso — trazer como pergunta.

---

## 1. Preferências da conta (`account_preference`)

**Origem:** o §3.4 do CORE prevê **três** preferências (permitir CPF/CNPJ duplicado,
carteirização, numeração de código do contato) e o §3.5 acrescenta **uma** (numeração de SKU) —
**quatro no total**. A contagem e os defaults já estavam registrados em `DEPENDENCIAS_EXTERNAS.md §8`
("Duas preferências decididas por default, e escritas"), que conta as três do §3.4; a de SKU vem do
bloco de Produto do mesmo arquivo. Este item unifica as duas contagens: **quatro**.

Já decidido (Eliab, 14/08/2026, registrado no `DEPENDENCIAS §8`): documento duplicado =
**não permitir**; numeração de contato = **manual**; SKU = **manual**; carteirização =
**fora até VND/ROT**. O `DEPENDENCIAS §8` traz também a razão técnica da numeração: sequencial
"exige contador por tenant — lock ou sequence, design próprio, não um campo".

**Estado:** ~~nenhuma estrutura existe em `account`~~ → **IMPLEMENTADO em 22/08/2026.** Colunas
nomeadas em `accounts` (`allow_duplicate_document`, `contact_code_mode`, `product_sku_mode`), VO
`AccountPreferences` com default declarado, `PATCH /account/preferences`. O documento duplicado
gateia a checagem de unicidade no Contato; `true` e `sequential` são recusados com mensagem (ver
DECISÃO abaixo). Carteirização segue fora, sem coluna.

⚠️ **DECISÃO 1.1 — forma de armazenamento.** Três opções:
- (a) `account.preferences` jsonb — simples, sem migration a cada preferência nova,
  mas sem validação de schema no banco e sem tipagem forte;
- (b) tabela `account_preference` (chave/valor por conta) — flexível, auditável, exige
  cast em toda leitura;
- (c) colunas nomeadas em `account` — tipadas e validáveis, migration a cada nova.

**Recomendação:** (c) enquanto forem poucas e estáveis. Preferência é regra de negócio,
não configuração livre; coluna nomeada torna o conjunto legível no schema. Migrar para
(a) depois é barato; o inverso não.

**Requisitos comuns a qualquer opção:**
- Toda preferência tem **default declarado em código**, nunca inferido de ausência.
- Alterar preferência que afeta visibilidade de dado (carteirização) exige registro.
- `account_preference` é tabela de tenant: `account_id NOT NULL` + RLS + cobertura no
  `verify:isolation` no mesmo commit.

**DECISÃO 1.1 — RESOLVIDA (22/08/2026): opção (c), colunas nomeadas.** Como preferência é regra de
negócio e o conjunto é pequeno e estável.

**DECISÃO 1.2 — `allow_duplicate_document = true` fica INDISPONÍVEL (Eliab, 22/08/2026).** Para o
`true` valer, o índice único `contacts_account_document_unique` teria de ser relaxado — e é ele quem
fecha a corrida entre duas requisições simultâneas com o mesmo documento (ver docblock de
`CreateContactUseCase`). Relaxá-lo trocaria garantia real por flexibilidade que ninguém pediu. O
default `false` funciona por inteiro; o setter recusa `true` com mensagem. Volta se um cliente
precisar. Mesma lógica para a numeração `sequential`: recusada até existir o contador por tenant.

---

## 2. `field_config` (§3.6)

**Origem:** §3.6 do CORE, integral. **Estado:** ~~não implementado~~ → **IMPLEMENTADO em
22/08/2026** (contexto `field-config`, tabela de tenant `field_configs` com RLS coberta pelo
`verify:isolation`, merge catálogo+config, obrigatório dinâmico, telas `/settings/fields`). Contato e
Produto já nasciam com `defaultVisible` declarado por campo em código, que é onde o §3.6 diz que o
catálogo mora — a config passou a sobrepô-lo.

Escopo V1: entidades `contact`, `product`, `order`.

**Modelo:** `account_id + entity + field` → `visible`, `required`, `label`, `order`.
Tabela de tenant, com RLS.

**Backend:** validação dinâmica de `required` nos DTOs, via pipe/validator custom. Campo
marcado obrigatório faz a API rejeitar payload sem ele (critério de aceite §7.5).

**Frontend:** formulários montados a partir da config, não estáticos.

**Invariante do §3.6, que não pode ser afrouxado:** o catálogo de campos por entidade é
**FIXO em código** (colunas reais). A config governa exibição e obrigatoriedade —
**nunca cria campo novo**. Um `field_config` apontando para campo inexistente no catálogo
deve falhar na escrita, não ser ignorado na leitura.

**Precedência:** config da conta sobrescreve o `defaultVisible` do catálogo. Campo sem
linha de config usa o default do catálogo (decisão (b) já tomada para Contato).

⚠️ **DECISÃO 2.1** — pode a config tornar **oculto** um campo que o domínio exige
(ex.: documento)? Recomendação: não. O catálogo declara `mandatoryByDomain: true` para
esses, e a config não os alcança — senão a tela impede o cadastro que o backend exige.

⚠️ **DECISÃO 2.2** — `SetFieldConfig` por intenção (frase) ou só por tela?

---

## 3. Categoria de produto em árvore

**Origem:** §3.5 ("categoria (árvore)"). **Estado:** Produto nasce com categoria como
texto simples, marcado provisório.

Escopo: entidade com auto-relacionamento, por conta.

⚠️ **DECISÃO 3.1 — profundidade máxima.** Ilimitada convida a árvores impossíveis de
navegar; 3 níveis cobre a prática de varejo. Recomendação: **3**, configurável em código.

⚠️ **DECISÃO 3.2 — mover subárvore.** Ao mover um nó, os filhos vão junto (esperado) —
mas o que acontece com produtos na categoria movida? Recomendação: acompanham, sem
alteração, porque a referência é ao nó e não ao caminho.

⚠️ **DECISÃO 3.3 — excluir categoria com produtos.** Bloquear, ou reatribuir ao pai?
Recomendação: bloquear, nomeando quantos produtos impedem — mesma regra do módulo com
dependente.

**Migração:** a coluna texto atual vira `category_id`; os textos existentes viram nós de
primeiro nível. Migration precisa de plano explícito de conversão.

---

## 4. Imagens e `StoragePort` (MinIO)

**Origem:** §3.5 ("Imagens: múltiplas, MinIO, ordenação") e §3.2 (logo da empresa).
**Estado:** MinIO não existe no ambiente. `companies.logo_object_key` guarda **chave do
objeto, nunca URL** — precedente a seguir.

**Dependência nova** (gatilho de parada): MinIO no `docker-compose.dev.yml`, SDK S3, e
variáveis no `.env.example`.

**Desenho:**
- `StoragePort` com adapter MinIO. Nenhum `if (provedor === ...)` fora do adapter.
- Persistir **chave**, nunca URL — URL assinada é gerada na leitura, com expiração.
- `product_image`: `product_id`, `object_key`, `order`, `alt`. Tabela de tenant, RLS.
- Upload valida tipo por conteúdo, não por extensão nem `Content-Type` do cliente.
- Limite de tamanho próprio da rota.

⚠️ **DECISÃO 4.1 — bucket por conta ou prefixo por conta?** Recomendação: bucket único
com prefixo `{account_id}/...`, mais simples de operar; o isolamento real continua sendo
a autorização na aplicação, nunca a estrutura do bucket.

⚠️ **DECISÃO 4.2 — o que acontece com os objetos no cancelamento da conta?** O §3.1 manda
exportar antes de cancelar. Imagem entra na exportação?

---

## 5. Certificado digital A1 (§3.2)

**Origem:** §3.2 ("Certificado digital A1 por empresa, upload pfx/p12, senha cifrada,
validade exibida — armazenado cifrado; consumido pelo FIS").
**Estado:** não implementado. Existe desenho anterior detalhado em trabalho de NF-e.

**Requisitos não negociáveis:**
- `.pfx`/`.p12`/`.cer`/`.key` no `.gitignore`. Nenhum certificado real no repositório.
- Senha **nunca** persistida em claro e **nunca** devolvida por rota alguma, nem mascarada.
- Arquivo nunca escrito em disco (`/tmp` inclusive); buffer sobrescrito antes do descarte.
- Validações no upload: tipo por conteúdo; senha (mensagem única para senha errada e
  arquivo inválido, evitando oráculo); **CNPJ do certificado × CNPJ da empresa** (erro
  bloqueante — é a causa clássica de rejeição na SEFAZ); vigência; emissor (avisa, não
  bloqueia); duplicidade por thumbprint.
- Substituição **nunca sobrescreve**: novo registro `active`, anterior `replaced`.
  O histórico prova qual certificado assinou qual período.
- Rate limit no upload; ação restrita a admin; toda tentativa gera evento.
- Aviso de vencimento em 30/15/7/1 dia.

⚠️ **DECISÃO 5.1 — custódia da senha.** Repassar ao provedor e descartar (modelo A) ou
cifrar e guardar (modelo B, exige chave de cifra custodiada). Recomendação: A, enquanto o
provedor de NF-e aceitar.

---

## 6. Port de notificação real (WhatsApp / e-mail)

**Origem:** §6 do CORE ("nasce aqui como port com adapter WhatsApp/e-mail; COM completo é módulo
futuro"). **Estado:** o port e o adapter existem, mas com o **nome real** `ResetCodeMessengerPort`
(`src/contexts/auth/application/ports/output/reset-code-messenger.port.ts`) e o adapter
`EvolutionResetCodeMessenger` (`src/infrastructure/whatsapp/evolution-reset-code.messenger.ts`) —
específicos do código de recuperação de senha, não um `NotificationPort` genérico. A instância do
Evolution é que não existe; bloqueado fora do repositório.

**Uso na V1:** código de recuperação de senha por WhatsApp (§3.3 e critério §7.3).

**Requisitos:**
- Resposta da rota de recuperação é **igual** para conta existente e inexistente — é
  desenho anti-enumeração, já implementado. O envio real não pode mudar isso.
- Falha de envio não pode revelar existência da conta ao chamador.
- Código com validade curta e teto de tentativas em transação própria (ADR-0004).

⚠️ **DECISÃO 6.1** — instância do Evolution: uma por conta ou uma de sistema? Custo e
isolamento puxam para lados opostos.

---

## 7. Consulta de CNPJ (§6)

**Origem:** §6 do CORE ("consulta CNPJ p/ auto-preenchimento — provider port; fase 1.1").
**Estado:** não implementado.

**Desenho:** `CompanyLookupPort` + adapter. Campo preenchido por consulta carrega
procedência própria ("consulta pública de CNPJ"), distinta de digitado e de lido por IA.
Falha do provedor **não** bloqueia o cadastro manual.

⚠️ **DECISÃO 7.1 — provedor.** §8 do CORE já registra como pendência ("escolher na
implementação"). Considerar custo, limite e disponibilidade da base pública.

---

## 8. Geocodificação assíncrona (§3.4)

**Origem:** §3.4 ("lat/lng com geocodificação assíncrona via BullMQ ao salvar endereço —
best effort"). **Estado:** colunas `lat`/`lng` nullable existem; job não.
**Dependência nova:** BullMQ + Redis (gatilho de parada).

**Recomendação:** entra junto com ROT, que é quem precisa de rota. Coluna nula é dado
ausente, não promessa de recurso.

---

## 9. Dashboard (§3.8)

**Origem:** §3.8. **Estado:** não implementado; rota `/dashboard` responde 404 de
propósito.

Cards da V1: vendas do período (VND), contas a receber/pagar dos próximos 7 dias (FIN),
pedidos por origem (VND), top produtos (VND).

**Bloqueio real:** três dos quatro cards dependem de VND e FIN. Um dashboard com um card
é pior que nenhum.

**Requisito transversal do §3.8:** filtro por empresa **e comparativo entre empresas**,
já na V1. Não é filtro opcional — é a dimensão obrigatória do §3.2.

**Recomendação:** entra depois de VND, com os cards que existirem, e o widget declara
quais módulos alimentariam os demais (mesma regra do limite de crédito).

---

## 10. Onboarding `CreateAccount` completo (§4, §7.1)

**Origem:** §4 (`CreateAccount`: conta + 1ª empresa + admin + módulos do plano/segmento) e
critério §7.1 ("conta nova operável em <5 min").
**Estado:** o use case existe; o fluxo de tela não.

⚠️ **DECISÃO 10.1 — módulos por segmento.** §4 diz "módulos do plano/segmento". Existe
catálogo de segmentos (varejo, distribuição, serviço...) com conjunto sugerido de
módulos? Isso não está em nenhuma fonte.

⚠️ **DECISÃO 10.2** — auto-registro público ou criação por operador do Veertex?

---

## 11. Controle de horários de acesso (§3.3)

**Origem:** §3.3 ("janelas por dia da semana, global e por usuário — **fase 2 do CORE;
deixar o modelo preparado, UI depois**").

**Estado (corrigido em 22/08/2026):** o **modelo está pronto, a UI é que falta.** Existem, desde a
`Migration20260808120000`: o Value Object `AccessWindow`
(`src/contexts/user/domain/value-objects/access-window.vo.ts`, com validação), a coluna
`users.access_windows jsonb`, o campo na entidade `User` e o método `changeAccessWindows`. O próprio
docblock do VO diz *"Modelled in F1, NOT enforced in F1"* — foi feito **de propósito**, atendendo ao
"deixar o modelo preparado" do §3.3.

A recomendação anterior ("não criar tabela agora; coluna inerte é a família da carteirização") foi
**removida**: ela contrariava o §3.3 do CORE (que manda preparar o modelo) e descrevia um estado que
não é o real. O modelo não é uma coluna inerte esquecida — é uma preparação deliberada e documentada,
com a decisão explícita de **não aplicá-la no login até a UI existir** (aplicar uma janela sem tela
para vê-la/corrigi-la trancaria o usuário para fora sem saída). O que falta é a UI e o ponto de
aplicação no fluxo de login — uma mudança de use case, não de schema.

---

## 12. Trilha de auditoria (ADR-0004)

**Origem:** ADR-0004, forma já decidida. **Estado:** não implementado.

**Duas tabelas, por razão de modelo:**
- **Pré-autenticação** (tentativa com e-mail desconhecido, força bruta por IP): tabela de
  nível de sistema, **fora do RLS**, sem `account_id` — não é dado de tenant nenhum.
- **Dentro da conta** (permissão negada, toggle bloqueado, troca de senha recusada):
  tabela de tenant, `account_id NOT NULL` + RLS.

**Contrapartida obrigatória:** a tabela de sistema será a única sem `account_id`. Como o
`verify:isolation` descobre tabelas de tenant por `pg_attribute`, a migration que a criar
**precisa acrescentar a exceção explícita no verificador, no mesmo commit** — senão o
boot passa a abortar, ou alguém afrouxa o verificador para "consertar".

**Migra para cá:** o log de exibição do aviso de imagem (hoje responde "foi exibido?",
não responde "quantas vezes, exportável para quem?").

---

## 13. Itens que voltam com outros módulos

| Item | Volta com | Motivo de estar fora |
|---|---|---|
| Carteirização (contato acessível só ao vendedor vinculado) | VND / ROT | É filtro de visibilidade de dado; meia implementação (coluna sem filtro) é falha de segurança que parece funcionalidade |
| Kit / `bundle` | EST | Estrutura de venda cujo sentido é baixar componente; sem EST o comportamento é errado em silêncio |
| Tabela de preço | ROT | FK para entidade inexistente |
| Campos de revendedor no contato | ROT (`04_Veertex_Rot.md`) | Documento nunca lido |
| Limite de crédito **aplicado** | VND / COB | Hoje o valor é guardado e a tela declara que não bloqueia |
| Custo médio do produto | EST | §3.5: "mantido pelo EST; exibido aqui somente leitura" |
| Saldo de estoque | EST | §3.5: "SALDO vive no EST" |

---

## 14. Ordem sugerida

1. `field_config` — pequeno, destrava o que Contato e Produto deixaram fora.
2. Preferências da conta — pequeno, remove quatro constantes de código.
3. VND — destrava carteirização, limite de crédito aplicado e três cards do dashboard.
4. EST — destrava kit, custo médio e saldo.
5. Dashboard — depois de VND.
6. Categoria em árvore, MinIO/imagens, certificado A1 — independentes, encaixam quando
   houver janela.

---

## 15. Decididos fora deste documento — que 01A, 02 e 03 ignoram

Estes já têm decisão registrada (ADR ou `DEPENDENCIAS_EXTERNAS.md`) e **não aparecem em nenhum dos
três documentos de requisito**. Ficam aqui para não se perderem entre uma fatia e outra — não são
pendências do CORE no mesmo sentido dos itens acima, são decisões vivas que o planejamento precisa
enxergar.

| Decisão | Onde está | Estado |
|---|---|---|
| **Ditado por voz** (gravar no navegador, transcrever no Gemini) | `ADR-0005`, `DEPENDENCIAS §6` | Decidido; **nasce desligado**; há medições registradas (e a correção de procedência de 15/08). |
| **Entrada por IMAGEM** (ler documento do cliente e preparar cadastro) | `ADR-0006`, `DEPENDENCIAS §7` | Desenho **CONFIRMADO por Eliab (14/08/2026)**; LGPD mais pesado que no texto; lacuna de billing é decisão de produto antes da tela. |
| **VEXGuard** (error-reporting próprio) | `DEPENDENCIAS §2`, `CLAUDE.md` | Port `ERROR_REPORTER` + adapter **no-op já no código**; troca-se o provider quando o Guard existir. Distinto da trilha de auditoria (item 12). |
| **`intent_draft` / pendentes da Mesa (§4.1)** | `DEPENDENCIAS §4` | Tabela e fluxo de pendências decididos; a Mesa despacha para os mesmos use cases do controller (é o que impede a intenção de ser caminho mais frouxo). |
