# ADR-0005 — Captura de voz: on-device por padrão; áudio a terceiro exige decisão do Eliab

| | |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-08-15 |
| **Decisor** | Eliab |
| **Contexto** | Ditado na Mesa. Duas implementações existem no código; só uma está ligada |

## Decisão

**O caminho vivo é o reconhecimento ON-DEVICE**, com `processLocally: true`, e ele fica **só na
Mesa**. A tela de Papéis continua por texto.

**O caminho de gravação + transcrição no Gemini existe no código e está DESLIGADO**
(`AUDIO_TRANSCRIPTION_ENABLED=false`). Ligá-lo exige **decisão do Eliab sobre enviar áudio a
terceiro** — não é decisão de implementação, não é rollout, e não se liga "para testar".

## Por que duas implementações, e por que a segunda não foi apagada

A segunda foi escrita por leitura errada de uma instrução ambígua (registrado no `CLAUDE.md`, regra
5). Eliab decidiu **não apagá-la**: ela está pronta, testada até a fronteira do envio, e o dia em que
a decisão sobre áudio for tomada — num sentido ou noutro — é melhor decidir com o código à vista do
que reescrevê-lo às pressas.

O risco de código parado é ele ser ligado por engano. Três coisas tornam isso improvável:

1. a flag nasce `false` e o código só liga com a string exata `'true'`;
2. o backend recusa a rota com a flag desligada, **antes** de tocar no provedor;
3. o frontend não renderiza o botão — ele pergunta ao servidor em `/intent/capabilities`.

## O que separa as duas, e é isto que a decisão pesa

| | On-device (**ligado**) | Gravação + Gemini (**parado**) |
|---|---|---|
| O que sai da máquina | **nada** | o áudio inteiro |
| Base legal | dispensa análise nova — nada é compartilhado | exige decisão: voz é biometria, e o microfone capta o que mais estiver sendo dito na sala |
| Qualidade em pt-BR | só o nível `command` (**medido**) | modelo multimodal, sem essa limitação |
| Nome próprio | **não medido** — a afirmação de que "derrete" veio de mensagem, não de medição | não medido |
| Onde vale | Mesa: frase curta e imperativa | (parado) |

⚠️ A linha "nome próprio" é o motivo de este ADR existir com esta cara. A troca de um caminho pelo
outro foi feita apoiada num defeito **que ninguém mediu** — ver a correção de procedência no
`DEPENDENCIAS_EXTERNAS.md` §6, e a regra 4 do `CLAUDE.md`.

## Por que Papéis fica sem microfone, mesmo se a medição for boa

Critério do Eliab, e independe do resultado: a frase daquela tela é ditado corrido com negação
(*"pode ver empresas mas não pode excluir empresa"*). Uma negação perdida produz uma frase
**coerente** que concede o oposto; a guarda de citação confirma o trecho, porque ele existe no texto
transcrito; e o operador aprova o que nunca disse. **Nenhuma camada abaixo pega isso.**

Na Mesa o erro equivalente é visível: o comando sai errado, o rascunho mostra campos errados, e nada
é gravado antes da aprovação. Em Papéis, o erro é silencioso e persiste.

## O que destrava a segunda implementação

Uma decisão do Eliab, com estas quatro perguntas respondidas — nenhuma delas técnica:

1. voz é dado biométrico. A base legal para tratá-la é qual?
2. o microfone capta o ambiente, não só quem fala. Quem mais está sendo gravado?
3. o áudio vai para um terceiro. Sob quais termos, e com qual retenção?
4. quem avisa o operador, e em que momento?

Enquanto as quatro não tiverem resposta, a flag fica `false` — e "está pronto" **não** é argumento
para ligá-la.

## Referências

- `CLAUDE.md` → *Regras aprendidas com defeito real*, regras 4 e 5
- `Requisitos/DEPENDENCIAS_EXTERNAS.md` §5 (canal e billing) e §6 (o que foi e o que não foi medido)
- Código vivo: `frontend/src/hooks/useOnDeviceDictation.ts`, `components/DictationButton/`
- Código parado: `frontend/src/hooks/useVoiceDictation.ts`, `components/MicButton/`,
  `backend/src/infrastructure/intent/gemini-audio-transcriber.ts`
