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

## Referências

- `CLAUDE.md` → *Testing Strategy* (a meta adiada) e *Security by Design Checklist*
- `Requisitos/ADR-0001_Modulos_no_JWT.md` — origem do claim `modules`, que fez o gate do smoke não
  poder passar na F1
- `backend/test/helpers/run-cli.ts` — o docblock explica por que processo e não função
