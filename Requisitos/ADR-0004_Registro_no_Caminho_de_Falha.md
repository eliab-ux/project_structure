# ADR-0004 — Registro no caminho de falha tem de sobreviver ao rollback

| | |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-08-11 |
| **Decisor** | Eliab |
| **Contexto** | Descoberto ao testar a recuperação de senha por WhatsApp até a fronteira do envio |

## O problema, em uma frase

**A exceção que sinaliza a falha destrói o registro dela.**

Toda requisição roda dentro de uma transação (`TenantTransactionInterceptor`, e não por opção: o
tenant chega ao Postgres por `set_config` transaction-local, então sem transação não há escopo). Um
Use Case que grava algo e depois lança tem a gravação desfeita pelo rollback que a própria exceção
provoca.

Isso não é um caso de borda. É o caminho **normal** de qualquer contador de tentativas, trava de
força bruta ou trilha de auditoria: essas coisas existem justamente para registrar o que deu errado,
e é exatamente quando dá errado que a transação morre.

## Como apareceu

O reset de senha por código no WhatsApp fazia, na ordem certa:

```ts
live.registerAttempt();       // incrementa
await this.codes.save(live);  // grava
const matches = await this.hasher.compare(command.code, live.codeHash);
if (!matches) throw new InvalidResetCodeException();   // ← rollback leva o incremento
```

Medido no banco depois de cinco tentativas erradas: `attempts = 0`. O limite de cinco existia no
código e **valia zero em produção** — um código de seis dígitos (1.000.000 de combinações) exposto a
força bruta durante os 15 minutos de validade, sem teto de tentativas.

Nada acusava: typecheck, lint e a suíte passavam. Só apareceu quando um teste conferiu o **efeito no
banco** em vez do comportamento aparente da função.

## Decisão

**Escrita que registra uma falha vai numa transação própria, que commita independentemente da
transação da requisição.**

```ts
async registerFailedAttempt(codeId: string): Promise<number> {
  const fork = this.em.fork();                       // EM independente, herda o escopo do tenant
  return fork.transactional(async (tx) => {
    await tx.getConnection().execute(
      'update password_reset_codes set attempts = attempts + 1, updated_at = now() where id = ?',
      [codeId], 'run', tx.getTransactionContext(),
    );
    // ... lê o valor de volta ...
  });
}
```

Três exigências, todas com motivo:

1. **Transação própria** (`em.fork()`), para sobreviver ao rollback. O fork herda os parâmetros de
   filtro, então o `TenantScopeSubscriber` escreve o `set_config` também nela — **nada contorna o
   RLS**, e o teste prova: se o GUC não fosse escrito, a policy bloquearia o `UPDATE` e o contador
   nunca chegaria a 5.
2. **Incremento como expressão SQL** (`attempts = attempts + 1`), nunca ler-somar-gravar. Duas
   tentativas simultâneas leriam o mesmo valor e gravariam o mesmo número — duas chances pelo preço
   de uma.
3. **Falhar fechado.** Zero linhas afetadas (policy recusou, linha sumiu) devolve o teto, tratando o
   caso como esgotado. Dúvida não vira permissão.

E a exigência que vale para o resto do código:

4. **Onde não é preciso registrar nada, valide ANTES de gravar.** É o que o restante dos Use Cases já
   faz, e é imune ao problema por construção — ver o levantamento abaixo.

## Levantamento — todos os pontos verificados

Feito sobre os 25 Use Cases da F1 mais os da F2, cruzando quem grava com quem lança.

### Classe 1 — gravam e depois lançam (o defeito de verdade)

| Use case | Situação |
|---|---|
| `reset-password` | **Era o único.** Corrigido |

Em todos os outros, os `throw` estão **antes** das gravações — validar-depois-gravar. O rollback não
tem o que desfazer, e a ordem correta é a proteção. Verificado um por um em `account` (3),
`auth/change-password`, `auth/login`, `company` (3), `module/toggle-module`, `role` (2) e `user` (3).

### Classe 2 — deveriam registrar e não registram nada durável

Aqui não há bug de rollback, porque não há gravação. Há uma ausência — e, no dia em que ela for
preenchida, cai exatamente na Classe 1 se este ADR não for seguido.

| Ponto | Hoje | Consequência |
|---|---|---|
| Login recusado (senha errada / e-mail desconhecido) | `Logger.warn` para stdout | Nenhuma contagem, nenhum bloqueio, nenhuma trilha |
| Permissão negada (`PermissionGuard`) | **nem log** — só `ForbiddenException` | Tentativa de escalar privilégio não deixa rastro |
| Toggle de módulo bloqueado | `Logger.log` só no sucesso | Recusa por dependência ou por plano não deixa rastro |
| Troca de senha recusada | `Logger.warn` | Sem contagem |

**Não existe tabela de auditoria.** As nove tabelas são `accounts`, `companies`, `users`, `roles`,
`plans`, `modules`, `account_modules`, `password_reset_codes` e as de migration. Todo registro de
falha hoje é linha de log em stdout — que não é consultável por conta, não sobrevive a restart de
container e não serve para decidir bloqueio.

### Classe 3 — o buraco maior, e ele não é de rollback

**O login não tem limite de tentativas nenhum.** Nem throttle por IP, nem contador por usuário, nem
bloqueio temporário, nem `@nestjs/throttler` no projeto, nem coluna de tentativa em `users`.

A comparação com o que acabou de ser corrigido:

| | Código de reset | Senha |
|---|---|---|
| Espaço de busca | 1.000.000 (6 dígitos) | ≥ 8 caracteres |
| Validade | 15 minutos | indefinida |
| Tentativas | **5** (agora valendo) | **ilimitadas** |
| Uso | uma vez | permanente |

O código de reset — o segredo mais fraco, mais curto e mais efêmero do sistema — é o único que tem
teto. A senha, que vale mais e não expira, não tem. Corrigir a trava do reset sem tratar isto é
trancar a janela e deixar a porta aberta.

## Consequências

**Para código novo.** Antes de gravar algo num Use Case, pergunte: *esta escrita precisa sobreviver a
uma exceção neste mesmo fluxo?* Se sim, transação própria e as três exigências acima. Se não, valide
antes de gravar.

---

## Aplicação 1 — limite de tentativas de login (IMPLEMENTADO)

DECIDIDO (Eliab, 11/08/2026), em duas camadas, e a segunda é a que exige explicação.

### Camada 1 — teto de falhas por IP

É de onde a força bruta vem. Conta apenas **falhas**, e com folga deliberada (50 em 5 minutos): num
varejo, **todos os terminais de PDV de uma loja saem pelo mesmo IP público**, e um teto apertado
tiraria a loja do ar por causa de operadores digitando senha errada. Estourado o teto, `429`.

É a única recusa **dura** do desenho, e é segura contra enumeração porque depende de quantas falhas
vieram daquela origem — nunca de qual e-mail foi tentado, nem de ele existir.

O IP real vem de `X-Forwarded-For` (o Fastify sobe com `trustProxy: true`, necessário atrás do
Traefik). Sem isso, toda requisição de produção contaria para o mesmo "IP" — o do proxy — e o teto
derrubaria a plataforma inteira depois de algumas falhas. Há teste cobrindo exatamente isso.

### Camada 2 — atraso progressivo por credencial, nunca bloqueio

1s, 2s, 4s, 8s, com teto. **Atraso, e não bloqueio**, e o motivo é o vetor que o bloqueio abriria:
quem soubesse o e-mail de um operador o trancaria sem acertar senha nenhuma. Num ERP com PDV, isso é
**caixa parado no expediente** — o atacante não precisa entrar, basta impedir que o operador entre.

A chave é o **e-mail submetido**, não o id do usuário, e isso é exigência de segurança:

> Um e-mail inexistente tem de acumular exatamente o mesmo atraso que um existente. Se só contas
> reais atrasassem, o cronômetro passaria a responder "esta conta existe" — um oráculo de enumeração
> pela porta dos fundos, num fluxo desenhado inteiro para não ter um.

O atraso é aplicado **antes do lookup**, e a ordem é a garantia. Há um teste que mede o tempo das duas
situações e exige que a diferença fique dentro do ruído.

### Como as três regras se aplicam a um contador em memória

O contador vive na memória do processo (`InMemoryLoginThrottle`), não numa tabela. Alternativas:
Redis é dependência nova; tabela nova é mudança de modelo de dados — as duas fora do que se decide
sem consultar. E o efeito colateral é favorável:

| Regra | Como é satisfeita |
|---|---|
| 1. Sobreviver ao rollback | Por construção: nenhuma transação toca este estado |
| 2. Incremento atômico | O event loop do Node serializa o `+= 1`; não há leitura-e-escrita concorrente |
| 3. Falhar fechado | Na dúvida, o atraso é aplicado |

**O que isto não protege, dito claramente:** com N réplicas, o teto por IP vira N × o teto e a escada
é contada por processo; e restart zera tudo. Hoje o Veertex roda em um container só.

---

## Aplicação 2 — trilha de auditoria (FORMA DECIDIDA, IMPLEMENTAÇÃO ADIADA)

DECIDIDO (Eliab, 11/08/2026): a forma fica registrada agora porque há uma **tensão de modelo** que
não se resolve na hora de escrever a migration.

### A tensão

Falha de login com e-mail inexistente **não tem `account_id`** — não se sabe de qual conta era, porque
não era de nenhuma. E o §3.1 exige `account_id NOT NULL` + RLS em toda tabela de negócio. Uma tabela
só obrigaria a escolher entre violar o §3.1 (coluna nullable, policy que não vale para as linhas
órfãs) e perder justamente os eventos que mais interessam numa varredura.

### A decisão: DUAS tabelas, por natureza do evento

| | Eventos **pré-autenticação** | Eventos **dentro da conta** |
|---|---|---|
| **Exemplos** | e-mail desconhecido, teto de IP estourado, tentativa com credencial inválida | permissão negada, toggle de módulo bloqueado, troca de senha recusada, trava anti-lockout |
| **`account_id`** | **ausente** — a coluna não existe | **`NOT NULL`** |
| **RLS** | **fora** — tabela de nível de SISTEMA | **policy por `account_id`**, como qualquer tabela de negócio |
| **Quem lê** | operador da plataforma | a própria conta, e o operador |

O critério que separa as duas não é conveniência: **evento pré-autenticação não é dado de tenant.**
Atribuí-lo a uma conta seria inventar um vínculo que não existe — e, pior, atribuí-lo à conta cujo
e-mail *parecia* ser diria a quem lesse o log de uma conta que alguém tentou entrar nela, o que é
informação de outra conta.

A tabela de sistema fica **fora do RLS de propósito**, e por isso precisa da contrapartida: ela é a
única tabela do schema sem `account_id`, então o `verify:isolation` — que descobre as tabelas de
tenant por `pg_attribute` — não a exigirá com policy automaticamente. A migration que a criar tem de
acrescentar a exceção **explícita** no verificador, com o motivo, ou o invariante passa a ter um
buraco silencioso.

### Por que adiar a implementação

Auditoria completa de negócio é fatia própria: exige decidir retenção, volume, quem consulta, se há
tela, e o que é evento de negócio versus evento técnico. Registrar a forma agora impede a decisão
errada — a tabela única com `account_id` nullable — de ser tomada às pressas por quem for
implementar.

**Continua não implementado:** o registro em si de login recusado, permissão negada (o
`PermissionGuard` hoje não loga nada) e toggle bloqueado.

---

## Sinal de que a decisão precisa ser revista

- **Uma segunda réplica do backend.** No momento em que houver duas, `InMemoryLoginThrottle` precisa
  virar armazenamento compartilhado — o port existe exatamente para que a troca não toque o Use Case.
  Até lá, contador compartilhado é complexidade sem ganho.
- **Um relato de operador trancado fora.** Seria a prova de que a camada 2 virou bloqueio de fato, e o
  teto (`LOGIN_DELAY_MAX_MS`) precisa cair.
- **Um teto de IP atingido por cliente legítimo** — uma loja grande com muitos PDVs. `LOGIN_IP_FAILURE_LIMIT`
  sobe, ou o teto passa a ser por (IP, janela) mais generoso.
- **A primeira escrita de auditoria.** É quando a forma acima sai do papel, e quando a exceção no
  `verify:isolation` tem de ser acrescentada junto — não depois.

## Alternativa descartada

`allowGlobalContext` ou gravar fora de transação nenhuma. Resolveria o rollback e abriria mão do
escopo de tenant na escrita — isto é, trocaria um buraco de força bruta por um de isolamento. A
transação própria mantém o RLS valendo, que é a única forma aceitável.

## Referências

- `backend/src/infrastructure/persistence/mikro-orm/repositories/password-reset-code.repository.ts`
- `backend/test/integration/password-reset.spec.ts` — a asserção que confere `attempts` no banco
- `Requisitos/ADR-0003_Testes_de_Execucao_no_lugar_da_meta_de_80.md` — por que o teste que pegou isto
  confere efeito, e não comportamento aparente
