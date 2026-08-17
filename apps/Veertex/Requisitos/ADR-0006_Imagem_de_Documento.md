# ADR-0006 — Imagem de documento: processa, descarta, e o aviso é requisito

| | |
|---|---|
| **Status** | Aceito · implementado em 2026-08-15 |
| **Decisor** | Eliab |
| **Destrava-se por** | Billing ativo no canal do Gemini (`DEPENDENCIAS_EXTERNAS.md` §5), resolvido em 15/08/2026 |

## O que foi construído

Foto de documento na Mesa → o tradutor lê → os campos entram no rascunho para conferência → o
humano aprova. A imagem **não é persistida em lugar nenhum**.

```
câmera/arquivo → comprime no cliente (~300 KB) → base64 no corpo do POST /intent
   → Gemini lê (inline_data)  → campos com origin "externo" e review true, IMPOSTOS
   → rascunho na tela, com marca visual de fonte externa
   → aprovação humana → CreateContact
```

## As cinco garantias, e onde cada uma mora

| Garantia | Onde é imposta | Por que não basta pedir |
|---|---|---|
| A imagem não é gravada | não há escrita: sem `multer`, sem arquivo temporário, sem cache. Vive no corpo e morre com ele | — |
| `origin: 'externo'` + `review: true` em todo campo lido | **`GeminiIntentParser.validate()`**, à força | a instrução pede, mas o modelo pode devolver "ditado". Pedido não é garantia, e um CPF de OCR com cara de digitado é o defeito exato que o §6.1 existe para impedir |
| Fonte externa distinguível na tela | `IntentDraftPanel` — chip "lido da imagem" + borda de atenção | §6.1 |
| Limite de tamanho próprio | DTO: 8 MB de base64, contra 25 MB globais do Fastify | cada chamada com imagem é paga por token, e 25 MB numa rota autenticada é jeito barato de gastar a conta de alguém |
| A imagem não entra em log | nem base64, nem tamanho em `catch` | um log de documentos é pior que o envio |

## O aviso ao titular — e por que ele é exigido pelo backend

O problema que o aviso endereça é **anterior ao provedor**: o titular do documento não é parte do
contrato entre o Veertex e a conta. Ele não assinou nada, e não sabe que a foto dele foi enviada.
Nenhum termo com o Google muda isso.

O aviso divide o que dá para dividir: **o Veertex informa; o operador obtém o consentimento.** Ele
aparece **antes de a câmera abrir** — depois seria informação sobre algo já feito — e diz três coisas:

1. a imagem é enviada a um provedor de IA externo para leitura;
2. ela **não fica armazenada**;
3. **obter o consentimento do titular é responsabilidade de quem fotografa**.

**A exibição é registrada, e o backend recusa sem o registro.** `noticeAcknowledgedAt` viaja com a
requisição; sem ele, `ImageNoticeRequiredException` (400) — antes de qualquer chamada paga. A
checagem vive no servidor de propósito: se vivesse só na tela, a primeira refatoração de UI a
removeria sem ninguém notar.

⚠️ **É registro em LOG, não trilha de auditoria.** Um log estruturado (conta, usuário, horário,
mime) responde *"foi exibido?"* hoje. Não responde *"quantas vezes, em que período, exportável para
quem?"* — isso é a trilha do ADR-0004, que não existe porque tabela nova é mudança de modelo de
dados. Quando a trilha vier, este registro migra para ela.

## O botão só existe onde o dado tem onde cair

Duas condições, ambas necessárias — nada de casca:

- **`contacts.create`**: a leitura serve para cadastrar contato. Sem a permissão, a foto produziria
  um rascunho que a aprovação recusaria — depois de alguém ter fotografado o documento de terceiro;
- **`imageIntake`** do servidor: diz se o tradutor **configurado** sabe ler imagem. O adapter
  determinístico não sabe, e **recusa o anexo em voz alta** em vez de ignorá-lo — ignorar faria a
  suíte passar enquanto produção lê a foto (regra 1 do `CLAUDE.md`).

## O que ficou de fora

| | Por quê |
|---|---|
| **PDF** | **Fora por decisão, não por adiamento** (Eliab, 17/08/2026). O caso real é **foto de cartão CNPJ ou documento no balcão** — papel na mão, celular apontado. PDF pertence a outro cenário (arquivo recebido por e-mail), traria outro fluxo (múltiplas páginas, seleção de página) e não tem prévia nem compressão no cliente. Não é "quando aparecer o caso de uso": o caso de uso é conhecido, e é foto |
| **Persistir a imagem** | Decisão do Eliab: processa e descarta. Guardar traria retenção, exportação no cancelamento (§3.1) e uma superfície de vazamento que hoje não existe |
| **Resolver entidade por busca aproximada** | Registrado como próximo passo: o nome lido da imagem deveria casar com contato existente antes de criar duplicado. Hoje o rascunho é conferido pelo humano, que é a rede de segurança — a busca aproximada é melhoria, não pré-requisito |

## Referências

- `DEPENDENCIAS_EXTERNAS.md` §5 (canal e billing) e §7 (o desenho, decidido em 14/08)
- `ADR-0004` — a trilha de auditoria que este log vai alimentar quando existir
- `ADR-0005` — captura de voz, a decisão irmã sobre o que sai da máquina
