# ADR-0003 — Testes de execução no lugar da meta de 80% de cobertura

| | |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-08-11 |
| **Decisor** | Eliab |
| **Contexto** | Fechamento da F1 — validação local completa após os primeiros defeitos encontrados em execução real |

## Contexto

O `CLAUDE.md` define, em *Testing Strategy*, cobertura alvo **acima de 80% nas camadas domain e
application**. Ao validar a F1 no Postgres local, constatou-se que o backend tinha **um único
arquivo de teste** (`tenant-isolation.spec.ts`) — nenhum teste unitário de entidade, Value Object ou
Use Case.

A conclusão óbvia seria escrever a suíte unitária. O que decidiu contra foi a **origem dos quatro
defeitos** encontrados ao executar, pela primeira vez, comandos que nunca tinham rodado:

| Defeito | Onde estava | Teste unitário pegaria? |
|---|---|---|
| `RequestContext` ausente nas CLIs | Fronteira de execução — `AppModule` fora de requisição HTTP | **Não.** O Use Case chamado direto funciona |
| Senha do admin em argumento | Fronteira de execução — eco do `npm run` | **Não.** Não há unidade envolvida |
| CNPJ do seed com dígito inválido | Dado de fixture | **Não.** O VO `Document` funcionou — foi ele que recusou |
| `Logger.log()` engolido pelo nível de log | Configuração do contexto Nest | **Não.** Só aparece olhando o stdout do processo |

Quatro de quatro invisíveis para teste unitário. E o `Document` merece destaque: ele **funcionou
perfeitamente**, e uma suíte de VO teria confirmado que funciona — sem chegar perto do defeito, que
era o número errado no arquivo de seed.

Houve ainda um quinto achado, de natureza distinta: o `smoke:auth` exigia o claim `modules` no JWT,
que só existe na F2. Como o arquivo é idêntico nas duas branches, **o gate da F1 nunca teve como
passar verde**. Teria falhado na primeira execução contra produção por um motivo que não é defeito
do produto.

## Decisão

**Adiar a meta de 80%** e investir, no lugar dela, em **teste de execução por ponto de entrada** e
**integração dos Use Cases com RLS ativo**.

O que passou a existir:

| Arquivo | O que executa | Testes |
|---|---|---|
| `test/execution/create-account.cli.spec.ts` | o comando de onboarding, como processo | 9 |
| `test/execution/seed-dev.cli.spec.ts` | o seed, incluindo as duas barreiras | 7 |
| `test/execution/verify.cli.spec.ts` | os dois verificadores, aprovando **e reprovando** | 4 |
| `test/execution/smoke-auth.spec.ts` | o smoke contra servidor real via `createApp()` | 3 |
| `test/integration/use-cases.spec.ts` | auth, account e user com duas contas e RLS | 10 |
| `test/integration/tenant-isolation.spec.ts` | as asserções do §7.2 (pré-existente) | 3 |

Três princípios que os guiam, e que valem para o que vier depois:

1. **Processo, não função.** As CLIs rodam por `spawn`, não por `import`. Parsing de argumento,
   ordem de import, configuração de log e código de saída só existem quando há um processo — e é
   onde os quatro defeitos moravam.
2. **Uma configuração só.** O servidor do teste sobe por `createApp()`, a mesma função do `main.ts`.
   Um app montado à parte passaria sem prefixo `/api`, sem `ValidationPipe` e sem
   `GlobalExceptionFilter`, e as asserções descreveriam algo que ninguém opera.
3. **Todo gate tem de ser visto falhando.** `verify.cli.spec.ts` cria uma tabela com `account_id` e
   sem policy, e exige que o verificador **reprove** e **nomeie a tabela**. Um gate que nunca falhou
   é indistinguível de um gate que não verifica nada.

## Consequências

**Preço.** A suíte fala com um Postgres de verdade e sobe o `AppModule` a cada `spawn` — cerca de
12 segundos por invocação de CLI. Roda em ~3 minutos, contra os poucos segundos de uma suíte
unitária. O `jest.config.ts` usa `maxWorkers: 1`, porque todos os specs compartilham o mesmo banco.

**O que fica descoberto.** Regra de negócio de domínio sem caminho por CLI, HTTP ou Use Case
integrado — por exemplo, um método novo de entidade ainda não usado por ninguém. É um risco aceito
conscientemente, e o menor dos dois: código que nada chama não está em produção.

**Isto NÃO é dispensa da meta.** É um adiamento com motivo datado.

### Sinal de que a decisão precisa ser revista

Qualquer um destes três traz a meta de volta:

- **domínio ganhar regra com muitos ramos** (cálculo de comissão, faturamento, imposto), onde a
  tabela de casos é o teste certo e integração seria caríssima;
- **um defeito que teste unitário teria pego chegar a produção** — é a evidência empírica contra esta
  decisão, e ela vale mais do que o raciocínio que a sustenta;

  ⚠️ **A recíproca NÃO vale.** A ausência de defeitos dessa classe não é evidência a favor do
  adiamento, e a tentação de tratá-la assim já apareceu nesta conversa. O motivo é simples: a suíte
  unitária não existe, então **essa classe de defeito não está sendo medida**. Não encontrar o que
  não se procura não diz nada sobre haver o que encontrar.

  O gatilho mede o que **chega a produção** — que é observável independentemente de haver suíte —,
  nunca o que uma suíte inexistente deixou de achar. Enquanto nada chegar, a decisão continua de pé
  por seu próprio argumento (os defeitos reais estavam na fronteira de execução), não por um silêncio
  que ela mesma produz;
- **a suíte de execução passar de ~5 minutos**, quando dividir em camadas volta a compensar.

## Alternativas descartadas

| | Por que não |
|---|---|
| **Escrever a suíte unitária agora** | Cobriria a camada onde nenhum dos quatro defeitos estava. Cumpriria a meta sem reduzir o risco que se materializou |
| **Unitário + execução, os dois** | É o destino, não o próximo passo. Fazer os dois agora atrasaria a F2 e a F3 para cobrir uma camada que ainda não tem regra complexa |
| **Deixar a meta como está e não cumprir** | É o que já acontecia. A diferença entre isto e a decisão acima é só uma: aqui está escrito |

---

## Adendo de 2026-08-13 — o custo que os testes de execução cobram: tempo real

Duas suítes desta estratégia **medem tempo real**, e é por isso que falham em máquina compartilhada
sem que nada esteja errado no código:

| Suíte | O que mede | Por que estoura |
|---|---|---|
| `test/integration/login-throttle.spec.ts` | o atraso progressivo por credencial, comparando medições adjacentes | o sinal é da ordem de 1,6s; concorrência por CPU move o piso e o teto |
| qualquer spec com `runCli` | um ponto de entrada real, em processo separado | o CLI sobe o Nest inteiro via `ts-node`; o teto de 30s do Jest estoura sob carga |

**Números medidos em 13/08/2026, na mesma árvore de código:** 14 falhas na primeira execução, 4 na
segunda, 0 na terceira. A variável era ambiente — dois dev servers no ar e um build de frontend
concorrendo. Rodadas sozinhas, as duas suítes: 17/17.

### Por que isto está registrado e não corrigido

Registrado porque **teste que falha por motivo alheio ensina a ignorar vermelho**, e isso é a coisa
mais cara que aconteceu neste projeto até aqui: um vermelho que às vezes não significa nada treina a
não olhar o vermelho que significa. É um defeito do processo, não de uma linha de código.

Não corrigido agora, e com as duas saídas fáceis descartadas de propósito:

- **Alargar a tolerância do teste de tempo** esconderia o defeito oposto — o atraso que parou de
  acontecer. Um teste de throttle que passa com e sem throttle não é teste.
- **Aumentar o `testTimeout`** faria o CLI travado esperar mais antes de reportar, o que troca uma
  falha rápida e clara por uma lenta e igualmente confusa.

O caminho real, quando incomodar: medir o atraso por instrumentação (o port do throttle informando a
espera calculada) em vez de por cronômetro, e manter o cronômetro num único teste marcado como
sensível a carga. Isso é fatia própria.

### O que fazer enquanto isso — regra prática

1. Rode a suíte **sozinho**: sem `next build`, sem dev server, sem typecheck em paralelo.
2. Falhou nessas duas? Rode **só elas**. Passaram → o vermelho era da máquina, e diga isso em voz
   alta em vez de deixar passar como "flaky".
3. Falhou por asserção (`expect(received)`) e não por `Exceeded timeout`? Aí é código. Investigue.
4. **Anote na tabela abaixo.** Terceira ocorrência da mesma suíte → deixa de ser da máquina e vira
   defeito a corrigir, na frente do que estiver na fila.

### O limite de três — por que a regra precisa de um teto

Decisão de Eliab, 14/08/2026: *"se a mesma suíte precisar da explicação 'era da máquina' três vezes,
ela deixa de ser da máquina e vira defeito a corrigir. Sem esse limite, a regra que protege contra
ignorar vermelho vira a justificativa para ignorá-lo."*

O ponto é exato. Uma explicação **verdadeira** e **ilimitada** é indistinguível de uma desculpa: as
duas produzem o mesmo comportamento — seguir sem olhar. E a explicação aqui é verdadeira, o que a
torna mais perigosa do que uma desculpa qualquer, porque não há atrito em repeti-la. Três é o ponto em
que "ambiente" deixa de ser a hipótese mais simples: uma suíte que falha com essa frequência está
frágil por construção, e a fragilidade **é** o defeito.

### Registro de ocorrências

Contagem por escrito, não de memória — contagem que vive na cabeça de alguém reinicia em cada sessão,
e três vezes esquecidas são três vezes que não aconteceram.

| # | Data | Suíte | Sintoma | Contexto |
|---|---|---|---|---|
| 1 | 2026-08-13 | `login-throttle` + specs com `runCli` | 14 falhas, depois 4, na mesma árvore | dois dev servers + `next build` concorrendo |

Na **terceira linha** de uma mesma suíte, o item sai desta tabela e entra como fatia: medir o atraso
por instrumentação (o port do throttle informando a espera calculada) em vez de por cronômetro, e
manter o cronômetro num único teste marcado como sensível a carga.

Registrado também no `CLAUDE.md`, em *Regras aprendidas com defeito real*.

## Referências

- `CLAUDE.md` → *Testing Strategy* (a meta adiada), *Regras aprendidas com defeito real* e
  *Security by Design Checklist*
- `Requisitos/ADR-0001_Modulos_no_JWT.md` — origem do claim `modules`, que fez o gate do smoke não
  poder passar na F1
- `backend/test/helpers/run-cli.ts` — o docblock explica por que processo e não função
