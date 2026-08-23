# PROPOSTA — Estrutura do App do Representante (Ionic React + Capacitor)

**Status: PROPOSTA para aprovação do Eliab — nenhuma linha de código do app foi escrita.**
Data: 23/08/2026 · Origem: 04 §4 (requisitos do app) e a decisão de stack registrada no 04 §4
(23/08/2026: Ionic React + Capacitor, racional térmica/GPS/SQLite). Item obrigatório do relatório
da Leva 1.

---

## 1. Onde o app vive: `apps/Veertex/mobile/`

O app entra no monorepo como **quarto vizinho** do backend, do frontend e dos Requisitos:

```
apps/Veertex/
├── backend/     (NestJS — já existe)
├── frontend/    (Next.js — já existe)
├── mobile/      (Ionic React + Capacitor — NOVO)
│   ├── src/
│   │   ├── app/            páginas Ionic (rotas do representante)
│   │   ├── components/
│   │   ├── db/             SQLite local: schema, migrações locais, DAOs
│   │   ├── sync/           motor de sincronização (fila de saída, pull de carga)
│   │   ├── native/         wrappers dos plugins (térmica, GPS, câmera)
│   │   └── services/       HTTP (mesma api.ts adaptada: token em storage seguro)
│   ├── capacitor.config.ts
│   ├── android/ ios/       gerados pelo Capacitor (versionados, como manda a doc)
│   └── package.json        workspace @gitspread/veertex-mobile
```

**Por quê no monorepo e não repo próprio:** o app consome os MESMOS contratos do backend
(DTOs, códigos de módulo, status de pedido). Repo separado = o contrato divergindo em silêncio —
exatamente o defeito que o ADR-0002 documentou nos pacotes copiados. O espelho de publicação
(`publish-mirror.sh`) já carrega `apps/Veertex/` inteiro; o mobile pega carona sem mudança no
mecanismo.

## 2. Compartilhamento de código com o web — o que compartilha e o que NÃO

**Compartilha (novo workspace `packages/veertex-contracts` OU pasta `apps/Veertex/shared/`):**

| O quê | Por quê |
|---|---|
| Tipos dos DTOs de request/response (pedido, viagem, recebimento, evidência) | é o contrato com o backend — uma fonte |
| Constantes: status de pedido/viagem, códigos de módulo, formas de pagamento | string repetida diverge |
| Funções puras de domínio visual: `valorPorExtenso`, formatação de moeda/documento, cálculo de totais do pedido (espelho do `round2`) | a promissória impressa na térmica tem de bater com o PDF da retaguarda AO CENTAVO |
| Validações yup dos forms que existem nos dois lados | mesma regra, mesma mensagem |

Recomendação: **`packages/veertex-contracts`** (workspace na raiz, TypeScript puro, zero deps) —
segue o padrão dos outros packages e o import-linter da arquitetura. Alternativa aceitável:
`apps/Veertex/shared/` se preferir não poluir `packages/` com algo de um app só. **Decidir na
aprovação.**

**NÃO compartilha:**
- Componentes de UI. O web é MUI + mouse + telas grandes; o app é Ionic + dedo + sol na tela.
  Componente "universal" fica ruim nos dois. O custo de duplicar UI é menor que o custo de
  abstraí-la.
- O `api.ts` do web (localStorage não existe no app; token vai em `@capacitor/preferences` com
  criptografia do SO). O interceptor é reescrito, o SHAPE do service é copiado.

## 3. Offline-first: SQLite local + fila de saída (duas propostas, A recomendada)

O dia de campo: o representante sai com a carga e a carteira NO APARELHO, opera o dia inteiro sem
sinal, sincroniza quando pega rede. O backend já foi desenhado para isso — pedido de rota nasce
como PROPOSTA (2 estágios), recebimento de campo nasce `proposto` e a retaguarda efetiva.

### Proposta A (recomendada): fila de mutações + pull por viagem

**Local (SQLite via `@capacitor-community/sqlite`):**
- Tabelas-espelho SOMENTE do que o campo lê: a viagem ativa, a carga (romaneio), a carteira de
  cobrança (títulos da `trip_collection`), contatos da rota, tabela de preço e condições
  permitidas pela Regra Comercial.
- Tabela `outbox`: cada ação do campo vira UMA linha imutável com `client_uuid` gerado no
  aparelho: abrir pedido (proposta), registrar recebimento, foto, GPS, despesa, promissória.

**Sync:**
1. **Pull na carga da viagem** (com sinal, antes de sair): baixa o pacote da viagem inteiro.
   Sem viagem ativa, o app não opera — espelha a regra de negócio (o campo só existe dentro
   de uma viagem).
2. **Push da outbox** (quando houver sinal, automático + botão manual): envia na ORDEM em que
   nasceu, um a um. Cada POST leva o `client_uuid` → o backend ganha coluna de idempotência
   (`client_uuid` UNIQUE por conta) nos endpoints de campo: reenvio após queda de rede não
   duplica pedido nem recebimento. **Este é o único retoque de backend que a fatia do app
   exige, e é pequeno.**
3. **Conflito: não existe por desenho.** O campo só CRIA (propostas, recebimentos propostos,
   evidências — tudo append-only no backend); quem edita/efetiva é a retaguarda. Sem UPDATE
   concorrente, não há merge — a "resolução de conflito" clássica de sync morre no desenho de
   dois estágios que o Eliab já ratificou.
4. Pull incremental leve a cada push OK: status dos pedidos da viagem (a retaguarda pode ter
   efetivado algo) — só leitura, sobrescreve o espelho.

### Proposta B (alternativa): replicação bidirecional com versionamento por linha

Espelho completo com `updated_at`/`version` por tabela, diff nos dois sentidos, resolução
last-write-wins com log. **Não recomendo:** resolve um problema (edição concorrente) que o
desenho de dois estágios já eliminou, ao custo do tipo de bug mais caro que existe (perda
silenciosa de dado em merge). Fica registrada como alternativa consciente.

## 4. Plugins nativos (os três do racional da decisão de stack)

| Necessidade | Plugin | Observações |
|---|---|---|
| **Térmica Bluetooth** (comprovante + promissória, ESC/POS) | `capacitor-thermal-printer` (BT clássico/BLE) com wrapper próprio em `native/printer.ts` | O wrapper expõe `printReceipt(model)` e `printPromissory(model)`; o layout ESC/POS vive em `packages/veertex-contracts` (o EXP vai reusar no futuro, 04 §4). **Reimpressão sempre**: os modelos impressos ficam no SQLite — 2ª via não depende de rede |
| **GPS em segundo plano** ligado ao status da viagem | `@capacitor/geolocation` (captura pontual no pedido) + `@capacitor-community/background-geolocation` (rastreio contínuo) | Rastreio LIGA na saída da viagem e DESLIGA no fechamento — nunca fora; consentimento explícito na primeira ativação, revogável, registrado (LGPD, 04 §4). Captura pontual do pedido é INDEPENDENTE do rastreio (funciona com consentimento negado) |
| **Câmera** (foto-comprovante, foto da promissória assinada) | `@capacitor/camera` | Compressão NO APARELHO antes de guardar (04 §3.1); binário fica no SQLite/filesystem até o push → MinIO via endpoint de evidência existente |

Todos os três têm wrapper fino em `native/` — a página nunca importa plugin direto. Teste em
browser roda com wrappers fake (mesma regra do adapter determinístico: fake nunca vira fallback
de produção — sem plugin, a ação FALHA visível, não finge).

## 5. Autenticação e segurança no aparelho

- Login = mesmo `/api/auth/login` (e-mail+senha); refresh token em `@capacitor/preferences`
  (Keystore/Keychain do SO), NUNCA em SQLite nem em texto plano.
- O app respeita módulo e permissão do token como o web (ROT ativo, permissões de campo).
- O SQLite local guarda dados da CONTA do usuário logado; logout apaga o banco local (o
  aparelho pode trocar de dono — chip de campanha cai, aparelho passa adiante).
- Regra Comercial aplicada NO PULL: o pacote da viagem já vem filtrado pelo backend
  (empresas/condições/tabelas permitidas) — o app não decide autorização, só exibe o que veio.

## 6. O que a fatia do app NÃO inclui (fronteiras)

- **Nada de retaguarda**: telas de fechamento/batimento são do web (Leva 1).
- **Sem push notification** no V1 do app (dependência de serviço externo — gatilho de parada).
- **Sem mapa/rota otimizada**: GPS captura e propaga; visualização em mapa é fatia futura.
- **iOS fica atrás do Android**: a operação real usa Android; iOS compila mas não é critério
  de aceite da primeira fatia.

## 7. Ordem de implementação proposta (quando aprovada)

1. Esqueleto do workspace + `packages/veertex-contracts` (ou `shared/`) + CI de build.
2. Login + pull do pacote da viagem + espelho SQLite (só leitura: carga, carteira, contatos).
3. Pedido-proposta offline + outbox + push idempotente (`client_uuid` no backend — o retoque).
4. Recebimento de campo + juros + formas (proposto → retaguarda efetiva).
5. Evidências: GPS pontual + câmera comprimida + push ao MinIO.
6. Térmica: comprovante + promissória (extenso compartilhado) + 2ª via.
7. Rastreio de fundo ligado ao status da viagem + consentimento LGPD.

## 8. Perguntas para a aprovação

1. **`packages/veertex-contracts` ou `apps/Veertex/shared/`** para o código compartilhado?
2. O `client_uuid` de idempotência nos endpoints de campo (retoque pequeno de backend) pode
   entrar já na próxima leva de backend, antes do app, para o contrato nascer pronto?
3. Rastreio de fundo: intervalo de captura (sugestão: 1 ponto a cada 5 min em viagem) e
   retenção (sugestão: pontos da viagem ficam 90 dias) — números a ratificar.
4. Impressora-alvo da homologação da térmica (marca/modelo real da operação) — preciso do
   hardware que o representante usa hoje.
