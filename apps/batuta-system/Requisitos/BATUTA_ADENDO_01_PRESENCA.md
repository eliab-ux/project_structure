# BATUTA — Adendo 01: fase de presença ("digitando") antes do envio

> **Leia junto com `BATUTA_SPEC.md`.** Este adendo altera a **Fase 7 (Despacho)** e
> acrescenta configuração na **Fase 1**. Todas as regras invioláveis e o escopo do spec
> permanecem valendo. Em conflito, o spec prevalece.

---

## 1. O que muda

Hoje o worker de despacho envia a mensagem assim que o job vence. Passa a existir uma
**fase de presença** antes do envio:

```
job vence
  → setPresence(contato, 'composing')      # "digitando..." aparece no aparelho do contato
  → aguarda D segundos                      # D aleatório, ver §4
  → sendText / sendMedia                    # envio real
  → setPresence(contato, 'paused')          # opcional, encerra o indicador
```

O indicador de "digitando" fica visível para o contato durante `D` segundos, e só depois
a mensagem chega.

---

## 2. Paralelismo — a regra que não pode ser implementada errado

**Sequencial DENTRO de cada canal. Paralelo ENTRE canais.**

```
✅ CORRETO
canal A: [presença → envio] ─── espera ─── [presença → envio] ───
canal B: [presença → envio] ─── espera ─── [presença → envio] ───   (simultâneo com A)
canal C: [presença → envio] ─── espera ─── [presença → envio] ───   (simultâneo com A e B)

❌ ERRADO — laço sequencial global
canal A envio → canal B envio → canal C envio → canal A envio → ...
```

O desenho errado faz 10 chips renderem como 1 e anula a razão de existir da frota.

**Implementação:** uma fila BullMQ (ou grupo/limiter) **por canal**, com concorrência 1
dentro do canal. Nunca uma fila global com concorrência 1. A serialização é por canal e
sai naturalmente do `scheduled_at` já calculado no planejamento.

---

## 3. Custo em throughput: zero

O spec já exige intervalo mínimo entre envios do mesmo canal (decisão pendente 5,
sugestão 45–120s com jitter). Os `D` segundos de presença acontecem **dentro** desse
intervalo, não além dele.

- Intervalo sorteado: 70s · presença: 9s → o canal fica 9s em "digitando" e 61s parado.
- **Não** some presença ao intervalo. Se `D` ≥ intervalo sorteado (configuração absurda),
  valide e recuse na configuração.

Conclusão: a presença **não reduz** a capacidade diária do canal. `current_quota` do
throttle adaptativo (§2.1 do spec) permanece intacta.

---

## 4. Duração — aleatória, nunca fixa

**Requisito:** `D` é sorteado por envio no intervalo `[presence_min_ms, presence_max_ms]`.

**Não implemente duração fixa.** Motivo: milhares de mensagens com exatamente 10,000s de
"digitando" é uma assinatura de máquina mais regular que qualquer comportamento humano —
o oposto do efeito pretendido.

Default sugerido: **6.000–14.000 ms** (média ~10s, o que o usuário pediu, com dispersão).

Opcional (registrar como evolução, não implementar na v1): escalar `D` com o tamanho do
texto, porque texto longo levaria mais tempo para ser digitado de verdade.

---

## 5. Modelo de dados

Acrescentar a `accounts` (Fase 1):

| Coluna | Tipo | Default |
|---|---|---|
| `presence_enabled` | boolean | `true` |
| `presence_min_ms` | int | `6000` |
| `presence_max_ms` | int | `14000` |

Validações na aplicação:
- `presence_min_ms` ≤ `presence_max_ms`
- `presence_max_ms` < intervalo mínimo configurado entre envios do canal
- `presence_max_ms` ≤ 20.000 (acima disso o estado `composing` expira no cliente do
  WhatsApp e o indicador desaparece antes do envio — o efeito se perde)

Acrescentar a `dispatches`:

| Coluna | Tipo | Observação |
|---|---|---|
| `presence_started_at` | timestamptz nullable | quando o `composing` foi emitido |
| `presence_duration_ms` | int nullable | `D` efetivamente aplicado |

Servem para auditoria e para conferir na prática se a fase está sendo respeitada.

---

## 6. Porta do gateway

Acrescentar a `WhatsAppGatewayPort`:

```ts
setPresence(
  instanceName: string,
  phoneE164: string,
  state: 'composing' | 'paused' | 'available' | 'unavailable',
): Promise<void>;
```

Adapter Evolution: endpoint de presença (`sendPresence` / `chat/presence`, confira o nome
na versão em uso). Resolução de servidor por conta segue a regra da Fase 2 do spec.

---

## 7. Regras de falha — presença é best-effort

**A falha da presença NUNCA impede o envio.** Ela é enfeite; a mensagem é o produto.

1. Chamada de presença com timeout curto (sugestão 3s) e `try/catch` próprio.
2. Falha na presença → **loga em debug, segue para o envio**. Não incrementa
   `dispatches.attempts`, não marca `FAILED`, não conta como falha para o circuit breaker
   e não conta para o `failure_rate` do throttle adaptativo.
3. Falha de presença **não** entra em `channel_quality_snapshots` como falha de envio.
   Contaminar o sinal de qualidade com erro de enfeite faz o throttle recuar sem motivo.
4. O `setPresence(..., 'paused')` pós-envio é opcional e igualmente best-effort.

---

## 8. Semântica de `scheduled_at`

`scheduled_at` passa a significar **início da fase de presença**, não o instante do envio.
O envio real acontece em `scheduled_at + D`.

Consequência que precisa estar na UI: `sent_at` fica alguns segundos depois de
`scheduled_at` por construção. Não é atraso, não é bug. Documente no painel de
acompanhamento para ninguém abrir chamado.

---

## 9. Aplicação em respostas da caixa de entrada

A fase de presença também se aplica às respostas enviadas pela Fase 8, com duração
**menor** (sugestão 2.000–5.000 ms).

Motivo: na resposta um humano está realmente digitando, e a fila prioritária não deve
carregar 10s de espera artificial por item. O objetivo aqui é continuidade visual da
conversa, não ritmo.

---

## 10. Nota honesta de eficácia — manter no documento

Registrado para não virar folclore interno depois:

1. **O mecanismo é especulativo.** Não há documentação da Meta indicando que presença
   entre no cálculo antiabuso. Ninguém fora da Meta sabe se pondera, e se pondera, quanto.
2. **Os sinais que de fato derrubam chip são comportamento do destinatário:** bloqueio,
   denúncia, taxa de entrega, proporção fala/escuta. O throttle adaptativo (§2.1 do spec)
   mede justamente esses, e continua sendo a mitigação principal.
3. **Há um efeito possivelmente contrário:** presença é uma chamada de API extra por
   mensagem, aumentando o tráfego da conexão. E duração fixa seria assinatura de máquina.
   A aleatorização da §4 existe por causa disso.
4. **O ganho real está no ritmo**, que o spec já tinha via intervalo mínimo e jitter — não
   no indicador em si.
5. **Benefício não especulativo:** experiência do destinatário. Mensagem precedida de
   "digitando" parece conversa, não disparo. Isso pode reduzir bloqueio por via
   comportamental, que é o caminho que **de fato** conta.

**Como saber se funcionou:** mantenha `presence_enabled` desligado numa fração dos canais
e compare `delivery_rate` e `opt_out_rate` entre os grupos ao longo de semanas. Sem
comparação, qualquer conclusão é impressão. Registrar como evolução, não implementar
agora.

---

## 11. Escopo — o que este adendo NÃO autoriza

A fase de presença é pacing e sinalização de estado. **Não** abre precedente para o que o
§2 do spec exclui por princípio, e o que segue continua fora:

- falsificação de metadado de dispositivo ou fingerprint
- rotação de proxy ou ofuscação de origem
- geração automática de variantes de texto para driblar detecção de duplicidade
- simulação de leitura de mensagem que não foi lida por humano
- qualquer resposta automática a inbound além do opt-out da §6.5 do spec

---

## 12. Testes obrigatórios

- presença é emitida antes do envio, com `D` dentro de `[min, max]`
- **`D` varia entre envios** — dois envios consecutivos não têm duração idêntica
- **canais processam em paralelo:** envios de canais distintos agendados para o mesmo
  instante ocorrem simultaneamente, não em sequência
- **serialização dentro do canal:** dois envios do mesmo canal nunca se sobrepõem
- falha na chamada de presença → mensagem **é enviada**, `attempts` não incrementa,
  circuit breaker não dispara, `failure_rate` não sobe
- timeout na presença não atrasa o envio além do timeout configurado
- `presence_enabled = false` → envia sem fase de presença, sem erro
- `presence_max_ms` ≥ intervalo mínimo do canal → configuração recusada na validação
- `presence_started_at` e `presence_duration_ms` persistidos no dispatch
- resposta da caixa de entrada usa a faixa curta de duração

---

## 13. Decisões pendentes acrescentadas

| # | Decisão | Fase | Sugestão |
|---|---|---|---|
| 14 | `presence_min_ms` / `presence_max_ms` default | 1 | 6.000 / 14.000 ms |
| 15 | Faixa de presença para respostas do inbox | 8 | 2.000 / 5.000 ms |
| 16 | Timeout da chamada de presença | 7 | 3.000 ms |
| 17 | Escalar `D` pelo tamanho do texto | — | fora da v1 |
| 18 | Teste A/B de `presence_enabled` para medir eficácia | — | fora da v1 |
