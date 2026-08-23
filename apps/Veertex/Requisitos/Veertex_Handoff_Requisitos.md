# Veertex (ex-RotaSales, ex-ABN Vendas) — Handoff Completo do Levantamento

> **Propósito:** consolida TUDO do levantamento de requisitos (jul–ago/2026). É a
> **FONTE-MÃE dos requisitos** do Veertex: nenhum MD de módulo nasce sem consultá-lo.
> **Estado (atualizado 23/ago):** levantamento ENCERRADO; desenvolvimento AUTORIZADO e em
> andamento (F1/F2/CORE/VND/EST implementados). A regra histórica "não produzir SQL" foi
> superada pela autorização do Eliab — vale o protocolo de fatias com aprovação.
> Rascunhos SQL citados adiante são referência histórica (identificadores em INGLÊS na
> implementação, decisão 03/ago).

## 1. PROJETO
**Veertex** (grafia com duplo "e", definida 07/ago/2026; antes RotaSales, antes ABN Vendas. Nota de marca: o duplo "e" distancia das colisões "Vertex" [Vertex Inc./fiscal, Google Vertex AI], mas verificar INPI/domínio antes de consolidar) — SaaS ERP
multi-tenant PME BR. Tese: completo (paridade SuasVendas) + simples (UX Bling) +
diferencial único (venda em rota/consignação/mascate). Stack: NestJS+Fastify+MikroORM,
**PostgreSQL self-hosted** (sem Supabase), Next.js, MinIO, Redis+BullMQ, Dokploy,
hexagonal (CLAUDE.md GitSpread), JWT próprio. Referências estudadas: SuasVendas,
Bling (conta OTEC), TECCOMMERCE (rotas Tudodicasa), planilhas reais de fechamento.

## 2. DECISÕES ARQUITETURAIS
1. **Banco único + `account_id` (pool model)** + RLS + runtime sem poder destrutivo +
   soft delete + PITR. Banco-por-cliente (modelo SuasVendas) DESCARTADO com análise
   (06/ago): blast radius mitigado nas 4 camadas; "instância dedicada" vira ADD-ON
   comercial p/ enterprise (híbrido: mesmo código, connection string própria).
2. "Personalizar Campos": colunas reais nullable + `field_config` (conta+entidade+campo:
   visível/obrigatório/rótulo/ordem). Sem EAV/JSONB.
3. **Venda = UM `order` com `origin`** (erp|pdv|rota|vitrine|marketplace) e
   `delivery_mode` (retirada|envio|rota_entrega).
4. **Modularidade Protheus c/ UX SaaS:** módulos toggle por conta; plano=teto;
   papel=visão; guard `@RequireModule`; desativar preserva dados.
5. **Ports & Adapters em TODO conector** (TEF, boleto, marketplace, fiscal, frete).
6. **Multi-CNPJ SEM hierarquia matriz/filial:** N CNPJs paralelos na conta; **estoque
   segregado por CNPJ (sem visão unificada)**; transferência entre CNPJs = operação
   FISCAL (NF de transferência); entre depósitos do mesmo CNPJ = livre. Depósito
   pertence a 1 CNPJ; venda sai de 1 CNPJ → 1 remessa. NF emitida com dados do CNPJ
   do depósito expedidor. (Modelo filial/Multi-CD do Bling absorvido como referência
   de mapeamento depósito↔canal.)
7. Uploads → MinIO; geocodificação de cliente em job assíncrono.
8. **(D1) Logística v1 = Correios PPN direto E agregador SIMULTÂNEOS**; N instâncias
   por CNPJ; matriz de capabilities por adapter; sem trava por plano.
9. **(D2) `CotarFrete` = use case único** com 3 entradas (vitrine/ERP/PDV); timeout ~3s
   c/ fallback; snapshot da cotação no pedido; divergência cotado×real → FIN.
10. **Identificadores de código/banco em INGLÊS** (CLAUDE.md); glossário pt→en do
    domínio de rota na modelagem.
11. **Contatos UNIFICADOS com tipos** (modelo Bling: cliente/fornecedor/transportador/
    vendedor/revendedor no mesmo cadastro) — decidido 06/ago.
12. **Kit ≠ Ficha técnica (SEPARADOS):** kit/composição comercial no VND (montagem
    simples estilo SV); ficha de produção no PRD (invisível p/ quem não produz).

## 3. CATÁLOGO DE MÓDULOS (PDFs gerados: Funcionalidades, Integrações, Catálogo)
Núcleo: CORE (conta, usuários/papéis granulares estilo Bling, cadastros, field_config,
dashboard/ABC) · VND (orçamentos/pedidos, tabelas de preço multi-canal c/ degrau,
comissionamento). Opcionais: EST (multi-local, trilha, inventário, expedição) · PDV ·
ROT (rota/mascate) · ENT (entregas) · PRD (produção) · CMP (compras) · FIS (NF-e/NFC-e,
contingência; f2: NFS-e, CT-e/MDF-e, SPED aux+Sintegra; f3: SPED completo, Reforma
IBS/CBS) · FIN (pagar/receber, DRE c/ plano de contas mapeado, centro de custo,
conciliação Open Finance, margem real) · COB (boletos, crediário/carnê) · CRM · CAN
(vitrine, Meli, Shopee f2, Meta catálogo) · COM (WhatsApp oficial, e-mail — engine
ÚNICA de notificação: templates+variáveis+eventos+canais, consumida por ENT/COB/VND/ROT)
· CTB (painel do contador: XMLs, relatórios, SPED aux, Sintegra) · API (REST+webhooks,
sync incremental, API key por usuário) · **OS + contratos/recorrência: ENTRAM (06/ago)**.
**Dependências CRM (06/ago):** CRM acopla a clientes (padrão); FUNIL depende de CRM;
AGENDA independente com vínculos OPCIONAIS (avulso ou ligado a cliente/pedido/lançamento).
Planos: Varejo · Distribuidor · Indústria · Digital · Completo.

## 4. FISCAL/LEGAL
- **IN 1608/25 GO:** vínculo automático pagamento↔NFC-e obrigatório (desde 1º/ago/26
  p/ todos acima de MEI). Fluxo atômico: venda → TEF/Pix dinâmico → NFC-e automática
  (tpIntegra=1, CNPJ credenciadora, bandeira, autorização). Contingência offline.
  Estorno desfaz TEF+fiscal junto.
- **Regimes-alvo (06/ago): Simples Nacional + Regime Normal (Presumido/Real) + MEI**
  — os três suportados (MEI: dispensas próprias).
- Tributação: NCM/CEST/origem/grupos por produto; grupo de produtos p/ herança fiscal;
  matriz por natureza de operação × UF × tipo cliente; rota crítica: consignação
  interestadual GO→MT/MS, devolução, troca, comissão revendedor. Detalhar c/ contador.
- Certificado A1 no servidor (cifrado); A3 fora do v1. "Sempre NF, sem declaração de
  conteúdo". CIF default configurável quando frete cobrado no pedido.
- Cancelamento de conta estilo Bling: 3 etapas + exportação prévia (nunca prender dados).

## 5. MÓDULO ROTA (coração) — modelo Tudodicasa/TECCOMMERCE
**Glossário:** REPRESENTANTE (leva mercadoria; ex-mascate/comissionado) · REVENDEDOR
(cliente da ponta que revende; ex-"cliente de rota") · AJUDANTE (viaja junto, opcional)
· GERENTE (retaguarda, controla rota E loja).
**Consignação:** Viagem N deixa mercadoria; revendedor assina PROMISSÓRIA (garantia,
gerada NA PONTA, térmica portátil, 1 por pedido) · paga na PRÓXIMA passagem (~60 dias)
· Viagem N+1 = acerto: pagou (dinheiro/Pix/cartão/cheque/DEPÓSITO) → vira venda;
devolveu → estoque do vendedor; trocou → TROCA-ENTRADA+SAÍDA casadas (dif. acertada);
não pagou → rola como RECOBRANÇA. Pedido nominal POR CLIENTE, item a item, no app;
ciclo: consignado_aberto → em_acerto → fechado. Campo lança "orçamento"; ESCRITÓRIO
confere e efetiva (2 estágios). Viagem N cobra N−1 e semeia N+1.
**Viagem:** 1 representante × 1 rota (sempre) + ajudante opcional. Caixa inicial/retorno,
Km inicial/final, datas. Rotas = regiões (Ceilândia, Rondonópolis...). Cliente
carteirizado por rota/representante.
**Regra Comercial por vendedor:** limita empresas/naturezas/condições/tabelas que o
representante usa em campo. Condições: PROMISSÓRIA (dominante), à vista, cartão,
cheque 60d, Pix, boleto. Workflow Autorizar Brinde → substituído por comissões.
**Evidências do pedido:** GPS capturado NA ABERTURA do pedido (imutável; edições nunca
tocam; mudança só por ação explícita do usuário, auditada) + atualiza cadastro do
cliente · foto-comprovante (cliente c/ pedido/documento) · foto da promissória ·
rastreamento do representante em viagem (ligado ao status, consentimento LGPD).
**App offline-first** (feature central); sincroniza depois; comprovante térmica OU
WhatsApp/PDF; reimpressão/2ª via sempre.
**Fechamento (planilhas reais absorvidas):** blocos Cobrança e Recobrança (consignado,
recebido por forma — dinheiro/cartão/PIX —, %, juros de atraso, VENDA À VISTA como
"outros recebimentos" fora da carteira, Dif.Troca) · Resumo (total a receber, recebido,
GASTO DA VIAGEM % , comparativo viagem anterior×atual) · despesas por categoria
(combustível, alimentação, hotel, pedágio, manutenção, outros) lançadas por dia ·
conferência SOMA FÍSICA × SOMA SISTEMA → acerto/resultado · folha de comissões.
**Crediário:** limite por cliente BLOQUEIA venda acima; título "perdida" = política a
detalhar; recobrança suportada mesmo que a meta operacional seja não usar.

## 6. COMISSÕES (FECHADO 06/ago — motor completo)
**Modelo por CADASTRO do vendedor:**
- **Modelo A — escala de META (loja):** vendido÷meta → faixas abertas >100%
  (100%→x, 150%→y, 200%→z...). Meta por vendedor×período. Vendedor da venda = usuário
  logado no PDV/pedido (troca rápida de operador por PIN anotada p/ spec).
- **Modelo B — escala de RECEBIMENTO (rota):** recebido÷carteira(cobrança+recobrança)
  → % DIRETO (ex.: ≥90%→8% · 70-89,99%→7% · 50-69,99%→6%), faixas customizáveis
  (pares "faixa % recebimento → % comissão"). Incide sobre recebido LÍQUIDO.
  Modelo 2 estágios (meta×redutor) DESCARTADO. Planilha real bate (96,72%→8%) =
  **massa de teste oficial** (recalcular abas históricas, bater no centavo).
- **Revendedor:** % individual por revendedor (~30%), via **DESCONTO NO ACERTO**
  (paga já líquido). Base do representante = líquido disso.
- **Gerente:** DOIS comissionamentos simultâneos — X% sobre loja + Y% sobre rota.
- **Ajudante:** **VALOR FIXO SEMANAL** (não é %; planilha sugeria 6% mas martelo é
  fixo); não efetua vendas (sem login de venda).
- Comissão apurada → contas a pagar (padrão Bling). Relatório consolida rota+loja.
- Recobrança comissiona igual à cobrança. Venda parcelada comissiona por recebimento.

## 7. DEMAIS MÓDULOS (decisões)
**PDV:** tela única 3 passos; consumidor final default; sessão de caixa c/ sangria/
suprimento/fechamento; TEF ABERTO/customizável por conta (TefProviderPort multi-adapter;
1º adapter puxado pelo 1º cliente real — sem escolha estratégica prévia); Pix dinâmico
(PixProviderPort; Sicoob candidato); **devolução → crédito OU troca na hora, SEMPRE
c/ confirmação do gerente (presencial OU APROVAÇÃO REMOTA por e-mail/WhatsApp)**;
pagamento misto N formas; troco padrão + **campo acréscimo/desconto EM REAIS p/
arredondamento de espécie** (189,78→189,80/189,75); desconto só c/ autorização do
gerente; atalhos = UX propõe.
**Produção:** ficha técnica versionada, OP, consumo/entrada, custo, perdas, sob demanda.
**ETAPAS CUSTOMIZÁVEIS POR PRODUTO (06/ago — premissa revertida):** roteiro
configurável (ex. serigrafia no meio p/ enxoval; outros ramos = outros roteiros).
Faseamento v1×v2 da implementação a definir na consolidação. Insumo=produto c/ tipo.
**Boletos:** v1 agregador (Kobana/TecnoSpeed/Asaas — escolher na implementação) →
Sicoob API → CNAB 240 sob demanda. Régua de cobrança automatizada (e-mail/WhatsApp,
templates c/ variáveis, carta de cobrança, leitura de retornos).
**Entregas:** rota de entrega ≠ rota de venda; fila → montar rota → sugestão de ordem
(Haversine v1, OSRM v2) → reordenação → entregue/falhou/reagendada; snapshot endereço;
POD (foto/assinatura/GPS) CONFIGURÁVEL; sem limite de paradas.
**Logística/frete:** doc próprio `ABN_Vendas_Levantamento_Logistica_Frete.md` (perdido
no reset de filesystem — regenerável do chat auxiliar se preciso; resumo: pipeline
config→cotação→remessa PPN→etiqueta PDF/ZPL→rastreio; credenciais por CNPJ c/ botão
Testar; remessa automática idempotente; catálogo de serviços c/ códigos; adicionais
c/ threshold; status normalizado; ZPL compartilhado c/ promissória). Fechamentos:
cubagem=modelo Bling; fallback cotação: tabela própria→manual→bloqueio só vitrine;
tabela própria v1 OK; handling configurável; 1 venda=1 remessa (CNPJ segregado);
duplicado mostra os dois; frete grátis/markup/sobrescrita c/ permissão SIM;
etiquetas em lote SIM; página rastreio white-label+notificações SIM; reversa V2;
embalagens padrão SIM; marketplace etiqueta V2.
**Canais:** hub port/adapter; Meli→Meta→Shopee; preço por canal via tabela; estoque
por local; pedido importado idempotente. Vitrine POR REPRESENTANTE com CÓPIA entre
representantes (envio a clientes por WhatsApp = fora; evolução COM).
**Importação/Migração:** layouts flexíveis c/ mapeamento de colunas, upsert idempotente,
relatório de erros, uso contínuo; entidades = 18 da API SuasVendas + rota (viagens,
carteira de promissórias!) + lista Bling (composições, campos custom, lotes, NF em
lote...). **Migrador SuasVendas DESBLOQUEADO:** doc oficial
https://documenter.getpostman.com/view/8635750/TVzYeZFu (token no painel; validar
schemas contra API_SuasVendas_v2.md na spec).
**Calculadora de precificação:** mobile/offline; custo+fixos+tributos+financeiro+margem
→ preços Varejo/Atacado/Rota (markup divisor); canal Rota INCLUI comissões
(representante+revendedor)+inadimplência esperada; decomposição; grava nas tabelas.
**Financeiro:** DRE c/ categorização explícita (árvore OTEC real absorvida), categorias
padrão por operação, transferência neutra, tarifas por evento; contas manual×automática;
Open Finance p/ conciliação; carteira pré-paga (agregador frete) × fatura (Correios).
**Notificações:** engine única no COM.

## 8. LEVANTAMENTO ENCERRADO (06/ago — todas as pendências de conteúdo fechadas)
- **⑬ RELATÓRIOS DO V1 (priorização do Eliab):** Pedidos faturados (filtros de datas
  distintas) · Vendas (filtros por cliente/fornecedor/data etc.) · Clientes mais
  rentáveis · Curva ABC de clientes · Curva ABC de produtos · Produtos mais vendidos ·
  Compras por fornecedor · Pedidos de compra · Financeiro: contas a pagar e a receber.
  **REQUISITO TRANSVERSAL: filtro/segmentação por INDÚSTRIA (= CNPJ/empresa da conta)
  em TODOS os relatórios, com visão separada por empresa E comparativo entre elas**
  (o Eliab tem 2 indústrias na conta — multi-CNPJ vira dimensão analítica).
- **⑭ ONBOARDING CONFIRMADO:** segmentos = os 5 planos (Varejo/Distribuidor/Indústria/
  Digital/Completo).
- **⑮ Transcrição do vídeo: nada além das telas** — cobertura das planilhas declarada
  completa.
Pendem apenas (consolidação/spec, não levantamento): ~~faseamento etapas de produção~~
**DECIDIDO 07/ago: etapas customizáveis JÁ NO V1 BASE do PRD (produção inicial exige
o procedimento — ficha + OP + roteiro por produto juntos desde a 1ª versão)** ·
**POLÍTICA "PERDIDA" DEFINIDA (07/ago):** título vira "perdida" automaticamente após
**1 cobrança sem recebimento + 3 recobranças** (4 passagens ao todo) — **limiar
CONFIGURÁVEL por conta** (cliente ajusta a automação como preferir). Efeito: **SAI da
lista de recobranças** (não viaja mais; não polui carteira/% do representante) mas
**PERMANECE no financeiro (contas a receber)** até ação MANUAL do usuário: cancelar
OU acerto manual lançando como DESPESA da empresa (write-off manual, com permissão).
Se o cliente pagar depois, baixa normal (título segue vivo no financeiro).
- **⑪ VITRINE FECHADA:** catálogo + PEDIDO; pedido nasce como PRÉ-PEDIDO/ORÇAMENTO
  (status do pedido) dependendo apenas da AUTORIZAÇÃO DO REPRESENTANTE responsável
  pela vitrine (pré-venda p/ próxima passagem).
- **⑫ COMPRAS FECHADA:** (1) cotação = comparação de preço de CUSTO entre todos os
  fornecedores do produto (usa o multi-fornecedor do cadastro); (2) aprovação antes
  de enviar ao fornecedor (conferência de ≥1 outra pessoa — alçada simples);
  (3) conferência de recebimento VIA XML DA NF-e contra o pedido de compra;
  divergência (pediu 100, NFe veio 80) → fecha o pedido original pelo entregue e
  **GERA NOVO PEDIDO DE COMPRA DO SALDO (20)** p/ o fornecedor emitir nova NFe
  (modelo saldo-vira-pedido-novo, não backorder pendente).
- **⑬ RELATÓRIOS V1:** pedidos faturados (datas distintas) · vendas (cliente/
  fornecedor/data) · clientes mais rentáveis · ABC clientes · ABC produtos · mais
  vendidos · compras por fornecedor · pedidos de compra · contas a pagar/receber —
  TODOS com filtro por INDÚSTRIA/CNPJ + comparativo entre empresas (transversal).
- **⑭ ONBOARDING:** segmentos = 5 planos. CONFIRMADO.
- **⑮ Transcrição do vídeo:** nada além das telas — cobertura completa declarada.
- **Etapas de produção: JÁ NO V1 BASE** (produção inicial exige o procedimento).
Externas restantes (no tempo do Eliab): agregadores · 1º adapter TEF · domínio/INPI.

## 9. COMO CONTINUAR
1. Modo: absorver→transcrever→confirmar→registrar. SEM SQL até autorização.
   Transcrições de voz têm erros fonéticos (KNABE=CNAB, TEFI=TEF, blind=Bling).
2. Ao fechar requisitos: consolidar por módulo → renomear docs p/ nome final →
   retomar modelagem (rascunhos da conversa traduzidos p/ inglês) fatia a fatia.
3. Docs do projeto a regenerar sob demanda (perdidos em reset de filesystem):
   Funcionalidades.pdf, Integracoes.pdf, Catalogo_Modulos.pdf,
   Levantamento_Logistica_Frete.md (fonte: chat auxiliar), Modelo_Dados.pdf (fonte:
   chat auxiliar — ATENÇÃO: gerado fora da regra de não-modelar; tratar como rascunho).
4. pt-BR; Eliab prefere passo a passo objetivo + análise de trade-off com recomendação.
