/**
 * O CATÁLOGO DE CAMPOS DO PRODUTO — fixo em código, como o §3.6 do CORE exige.
 *
 * > *"Catálogo de campos por entidade é FIXO em código (colunas reais); a config só governa
 * > exibição/obrigatoriedade — **nunca cria campo novo**."*
 *
 * ## O default é DECLARADO campo a campo, nunca inferido
 *
 * Mesma regra do Contato (decisão de Eliab, 14/08/2026), e aqui ela **pesa mais** — observação do
 * próprio Eliab em 19/08/2026: *"Produto tem muito mais campo opcional, então isso pesa mais aqui."*
 *
 * O número explica: são 34 campos, e a maioria é irrelevante para qualquer conta específica. Sem o
 * default declarado, a alternativa seria uma regra implícita — e as duas leituras possíveis dão telas
 * opostas:
 *
 *  - *"não configurado = visível"* → uma loja de serviços abre o formulário com DUN-14, CEST, itens
 *    por caixa e peso bruto. O operador conclui que o sistema é complicado, e ele está certo;
 *  - *"não configurado = oculto"* → campos somem sem ninguém saber por quê.
 *
 * A escolha foi a segunda **com o default escrito aqui, linha por linha**. A diferença entre "oculto
 * por regra implícita" e "oculto porque esta linha diz `defaultVisible: false`" é a diferença entre
 * default silencioso e decisão revisável: dá para ler, dá para discordar, e `git blame` responde quem
 * escolheu.
 *
 * ## Como isto é consumido HOJE, e como será depois
 *
 * O frontend lê este catálogo (via `GET /products/field-catalog`) e monta o formulário. Quando
 * `field_config` existir, o backend devolverá o catálogo **já mesclado** com a configuração da conta
 * — mesma rota, mesmo formato, e a tela não muda. É por isso que o contrato já tem `visible` e
 * `required` em vez de só a lista de nomes.
 */

/** Campo que sempre existe e nunca some — a config poderá mudar rótulo e ordem, nunca ocultar. */
export type FieldRule = 'base' | 'optional';

export interface ProductFieldDefinition {
  /** O nome da propriedade no DTO, e a chave que `field_config` usará. */
  field: string;
  label: string;
  /** O bloco da tela — o §3.5 organiza o formulário em abas. */
  group: 'header' | 'characteristics' | 'measures' | 'stock' | 'suppliers' | 'tax';
  rule: FieldRule;
  /**
   * O default de exibição, na ausência de configuração da conta.
   *
   * `false` não significa "campo morto": significa "existe como coluna, não aparece no formulário
   * até alguém pedir".
   */
  defaultVisible: boolean;
  /** Obrigatório por REGRA DE DOMÍNIO — a config da conta poderá exigir mais, nunca menos. */
  defaultRequired: boolean;
  /** Texto de apoio abaixo do campo. Usado onde o dado NÃO faz o que o nome sugere. */
  hint?: string;
}

export const PRODUCT_FIELD_CATALOG: readonly ProductFieldDefinition[] = [
  // ── Cabeçalho ────────────────────────────────────────────────────────────────────────────────
  {
    field: 'name',
    label: 'Nome',
    group: 'header',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: true,
  },
  {
    field: 'sku',
    label: 'SKU / Código',
    group: 'header',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
    hint: 'Preenchimento manual. Numeração sequencial automática ainda não existe.',
  },
  {
    field: 'kind',
    label: 'Tipo',
    group: 'header',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: true,
  },
  {
    field: 'unit',
    label: 'Unidade',
    group: 'header',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: true,
  },
  {
    field: 'condition',
    label: 'Condição',
    group: 'header',
    rule: 'base',
    // Novo é o caso de 99% dos cadastros, e o campo só interessa a quem vende usado.
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'basePrice',
    label: 'Preço de venda',
    group: 'header',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
    hint: 'Preço base do produto. Tabelas de preço por cliente ou canal ainda não existem.',
  },
  // ── Características ──────────────────────────────────────────────────────────────────────────
  {
    field: 'brand',
    label: 'Marca',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'categoryPath',
    label: 'Categoria',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
    // O aviso é honesto sobre o que o campo é HOJE: texto, não hierarquia navegável.
    hint: 'Texto livre. Use " > " para indicar nível (ex.: Ferramentas > Manuais). A árvore de categorias ainda não existe.',
  },
  {
    field: 'tags',
    label: 'Tags',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'ownProduction',
    label: 'Produção própria',
    group: 'characteristics',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'shelfLifeDays',
    label: 'Validade (dias)',
    group: 'characteristics',
    rule: 'optional',
    // Só interessa a quem vende perecível ou controlado.
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'barcode',
    label: 'GTIN / EAN',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'dun14',
    label: 'DUN-14',
    group: 'characteristics',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: 'Código da caixa (GTIN × quantidade por caixa). Usado no despacho em volume.',
  },
  {
    field: 'shortDescription',
    label: 'Descrição curta',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'longDescription',
    label: 'Descrição longa',
    group: 'characteristics',
    rule: 'base',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'externalUrl',
    label: 'Link',
    group: 'characteristics',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'videoUrl',
    label: 'Vídeo',
    group: 'characteristics',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  // ── Medidas ──────────────────────────────────────────────────────────────────────────────────
  // Visíveis por default, e não é preferência: são o único bloco cuja finalidade (§3.5, cotação de
  // frete) é verificável HOJE, sem depender de módulo nenhum. Esconder o que já funciona seria
  // esconder a única coisa que o widget de completude consegue prometer de verdade.
  {
    field: 'grossWeightKg',
    label: 'Peso bruto (kg)',
    group: 'measures',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
    hint: 'É o peso que o transportador cobra — com embalagem.',
  },
  {
    field: 'netWeightKg',
    label: 'Peso líquido (kg)',
    group: 'measures',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'widthCm',
    label: 'Largura (cm)',
    group: 'measures',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'heightCm',
    label: 'Altura (cm)',
    group: 'measures',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'lengthCm',
    label: 'Comprimento (cm)',
    group: 'measures',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'itemsPerBox',
    label: 'Itens por caixa',
    group: 'measures',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  // ── Parâmetros de estoque ────────────────────────────────────────────────────────────────────
  {
    field: 'minimumQuantity',
    label: 'Estoque mínimo',
    group: 'stock',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: 'Parâmetro de reposição. O saldo em estoque depende do módulo de Estoque, que não está disponível.',
  },
  {
    field: 'maximumQuantity',
    label: 'Estoque máximo',
    group: 'stock',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'location',
    label: 'Localização física',
    group: 'stock',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: 'Onde o item fica no depósito — prateleira, corredor, gaveta.',
  },
  // ── Fornecedores ─────────────────────────────────────────────────────────────────────────────
  {
    field: 'suppliers',
    label: 'Fornecedores',
    group: 'suppliers',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: 'Contatos com o tipo Fornecedor. Custo e código no fornecedor alimentam compras e precificação.',
  },
  // ── Tributação ───────────────────────────────────────────────────────────────────────────────
  // Todo o bloco começa OCULTO: sem o módulo Fiscal, preencher NCM e CEST não produz efeito nenhum,
  // e um formulário que abre pedindo dado fiscal para quem não emite nota é o formulário que faz o
  // operador desistir do cadastro. Quem precisa, liga o bloco.
  {
    field: 'origin',
    label: 'Origem da mercadoria',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'ncm',
    label: 'NCM',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: '8 dígitos. Campos fiscais são guardados no cadastro; a emissão depende do módulo Fiscal.',
  },
  {
    field: 'cest',
    label: 'CEST',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    hint: '7 dígitos, quando o produto está em substituição tributária.',
  },
  {
    field: 'itemType',
    label: 'Tipo do item',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'approximateTaxPercent',
    label: '% aproximado de tributos',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'taxGroup',
    label: 'Grupo fiscal',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
    // O aviso impede a leitura errada mais provável: que preencher o grupo já faça herdar regra.
    hint: 'Identificação do grupo para herança fiscal. A herança em si é aplicada pelo módulo Fiscal.',
  },
  {
    field: 'taxableBarcode',
    label: 'GTIN tributável',
    group: 'tax',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
];

/**
 * ⚠️ **Não existe entrada para CFOP, e a ausência é a decisão** (§3.5: *"CFOP NÃO é campo de
 * configuração global — erro do Nexo a não repetir"*).
 *
 * Um CFOP no cadastro do produto parece configuração e é armadilha: ele muda com a natureza da
 * operação (venda, remessa, devolução, bonificação) e com o destino. Guardar um valor fixo garante
 * que ele estará errado em toda operação diferente daquela que a pessoa tinha em mente ao cadastrar.
 *
 * Se alguém for "só acrescentar o campo", este comentário é o lugar onde a resposta já está.
 */
export const CFOP_DELIBERADAMENTE_AUSENTE = true;
