# 07_Veertex_Fis.md — Módulo FIS (Fiscal / NF-e)

> **Versão reescrita a partir da FONTE-MÃE** (handoff: fiscal, IN 1608/25-GO, naturezas
> da rota, regimes-alvo) — substitui o esqueleto. **Este documento é a SPEC ÚNICA do FIS.**
> Os §2.4/§2.9 do esqueleto (CFOP nunca é configuração; append-only; custódia do
> certificado) ficam RATIFICADOS integralmente.
>
> **Nota (23/08/2026, Eliab):** o alerta anterior de localizar o `NFE_VEERTEX_V2.md` foi
> **encerrado** — o documento **não existe como arquivo**; a referência era a uma sessão de
> levantamento anterior, não a um artefato materializado (busca no repositório confirmou a
> ausência). As decisões que aquela sessão produziu já estão ABSORVIDAS aqui como herança
> válida: defeitos F1–F9 endereçados pelo desenho, `invoice_events`/documento append-only,
> CFOP sempre derivado (nunca configuração), custódia do certificado A1, homologação nunca
> tratada como válida, **Focus NFe** como provedor candidato, e série com **número inicial
> configurável** (continuidade do Bling). Não há spec fina externa a procurar.

## 1. Decisões fechadas (respondem §3.1–§3.9 do esqueleto)

### 1.1 Provedor (§3.1)
**Provedor intermediário atrás de `FiscalDocumentPort`** — ratificado; candidato apontado
pelo trabalho anterior: **Focus NFe** (confirmar comercialmente no kickoff da fatia; se
indisponível, Nuvem Fiscal/PlugNotas no mesmo port). Emissão direta SEFAZ: descartada.

### 1.2 Documentos na V1 (§3.2)
**NF-e (55) na V1.** NFC-e (65) chega com o PDV — mas com um requisito JÁ registrado:
quando vier, o fluxo é **atômico com o pagamento** (IN 1608/25-GO, vigente: vínculo
pagamento eletrônico ↔ NFC-e com `tpIntegra=1`, CNPJ da credenciadora, bandeira,
autorização — os campos já nascem no `order_payment` do 02A) e com **contingência
offline** (caixa nunca para). NFS-e/CT-e/MDF-e: fases futuras nomeadas.

### 1.3 Natureza de operação (§3.3) — a entidade central, modelada
`operation_nature`: código, descrição, finalidade, e a **matriz de derivação fiscal**:
CFOP derivado de natureza × UF origem/destino × tipo de destinatário (contribuinte/
consumidor) — **nunca campo solto** (§2.4 ✓); CST/CSOSN conforme o **regime da empresa
emissora** (`simples | normal | mei` — os três suportados, decisão fechada; MEI com suas
dispensas); incidências (ICMS/ST, IPI, PIS/COFINS) por natureza + grupo fiscal do
produto. **Naturezas mínimas da V1** (a rota exige — cada uma com CFOPs próprios,
inclusive interestaduais GO→MT/MS da operação real): venda · **remessa em consignação** ·
**retorno de consignação** · **venda de mercadoria consignada** (o acerto!) · devolução
de venda · troca (entrada/saída) · bonificação · **transferência entre empresas** ·
entrada por compra. Detalhe tributário fino de cada uma: com contador na fatia
(pendência de spec declarada, não bloqueia o modelo).

### 1.4 Série e numeração (§3.4)
N séries por empresa (default 1), **número inicial configurável por série**
(continuidade de sistema anterior — requisito real vindo do Bling), inutilização de
número queimado = **evento**. Homologação × produção: **flag por empresa** + garantia de
que documento de homologação **nunca** é tratado como válido (critério de aceite) + botão
"testar comunicação" (padrão absorvido do Bling).

### 1.5 Contingência (§3.5) e eventos (§3.6)
NF-e: usar a contingência que o provedor abstrai (SVC) — sem UX própria na V1.
Eventos na V1: **cancelamento** (prazo legal) e **carta de correção**; inutilização de
numeração; manifestação do destinatário: fase 2.

### 1.6 Cálculo, DANFE e guarda (§3.8/§3.9)
Cálculo tributário: **do provedor** ✓. DANFE (PDF) e **XML no MinIO com retenção ≥ 5
anos** (política de retenção declarada na config de storage); XML de entrada (compras)
também será guardado quando o CMP chegar. Exportação p/ contador: módulo CTB (fase 2)
consome daqui.

## 2. Integrações com os outros módulos

- **VND:** faturar pedido → emitir NF-e (natureza "venda"); cancelamento pós-NF é daqui ✓.
- **ROT:** consignação emite **remessa** na carga, **venda de consignado** no acerto,
  **retorno** na devolução — o ROT chama; o FIS resolve documento e CFOP. (Sem FIS ativo,
  o ROT opera sem documentos — módulo é opcional por conta; a fronteira fica explícita.)
- **EST:** transferência entre empresas destrava aqui (movimento + NF de transferência
  na mesma operação coordenada).
- **CORE:** certificado A1 por empresa (custódia do `01A` ✓) é pré-requisito de emissão.

## 3. Entidades (conceitual)

`operation_nature` (+ regras de derivação) · `fiscal_document` (empresa, série, número,
tipo, status, chave, protocolo, xml_key, danfe_key, referência ao pedido/operação) ·
`fiscal_document_event` (append-only: emissão, autorização, rejeição, cancelamento,
CC-e) · `fiscal_series` (por empresa, próximo número) · config do provedor por empresa
(token cifrado, ambiente).

## 4. Ordem de fatias

1. Certificado A1 por empresa (pré-requisito de emissão — custódia do 01A).
2. `operation_nature` + matriz de derivação (com contador validando as naturezas da rota).
3. `FiscalDocumentPort` + adapter; emissão de NF-e de venda a partir do faturamento;
   eventos append-only; homologação primeiro.
4. Cancelamento + CC-e + inutilização.
5. Naturezas da consignação (integração ROT) e transferência entre empresas (destrava EST).

## 5. Critérios de aceite

Os 6 do esqueleto RATIFICADOS (nota na empresa/série corretas; **zero campos de CFOP
configuráveis**; certificado nunca em disco/senha nunca devolvida; documento+eventos
append-only; homologação nunca válida; zero violações) + 2 novos: (7) remessa de
consignação e venda de consignado emitem com CFOPs distintos e corretos por UF — validado
com casos interestaduais reais; (8) XML recuperável do MinIO por chave do documento.
