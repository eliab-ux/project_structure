import { DomainException } from '@gitspread/domain-primitives';

/**
 * FORMATO do produto — §3.5 do CORE.
 *
 * O enum tem os três valores porque o §3.5 pede o enum **aberto** ("variação = fase 2, requerida
 * antes do CAN completo — deixar enum aberto"). Mas dois deles são **RECUSADOS na criação**, e a
 * recusa é o que os torna honestos: enum que aceita valor sem implementação é pior que enum fechado,
 * porque o dado entra e ninguém sabe que o comportamento não existe.
 */
export const PRODUCT_FORMATS = ['simple', 'bundle', 'variant'] as const;

export type ProductFormat = (typeof PRODUCT_FORMATS)[number];

/**
 * Os formatos que esta fatia aceita. Os outros dois voltam com os módulos que lhes dão sentido.
 *
 * ## `bundle` (kit) — fora por inteiro, decisão de Eliab em 19/08/2026
 *
 * Nem a composição foi construída, e a distinção em relação ao limite de crédito do Contato é do
 * próprio Eliab:
 *
 * > *O limite é um número que alguém consulta; o kit é estrutura de venda cujo sentido é baixar
 * > componente ao vender. Sem EST, o usuário monta a composição, vende, e nada se move no estoque —
 * > não é campo inerte, é comportamento errado silencioso.*
 *
 * É a diferença entre um dado que não faz nada (visível, avisável no `hint`) e um dado que **parece
 * ter feito** algo. O §3.5 remete o estoque do kit ao EST — *"estoque do kit deriva dos componentes
 * (baixa componentes ao vender)"* —, então metade do recurso mora num módulo que não existe.
 *
 * **Voltou com o EST (22/08/2026):** `bundle` é criável de novo. A composição vive em
 * `product_components` (guardas de domínio: componente não é bundle, não é ele mesmo, quantidade > 0),
 * e o DISPONÍVEL do kit é DERIVADO dos componentes pelo EST (§2.5 do 03 — kit não tem saldo próprio).
 * A baixa dos componentes ao vender chega com a integração VND↔EST de faturamento.
 *
 * ## `variant` — fora até o CAN
 *
 * O §3.5 é explícito: implementação antes do CAN completo, não agora.
 */
export const CREATABLE_PRODUCT_FORMATS: readonly ProductFormat[] = ['simple', 'bundle'];

/** Produto ou serviço. Decide, entre outras coisas, se peso e dimensão fazem sentido. */
export const PRODUCT_KINDS = ['product', 'service'] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Novo ou usado — §3.5, "condição (`new|used`)". */
export const PRODUCT_CONDITIONS = ['new', 'used'] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

/**
 * UNIDADE COMERCIAL — lista fechada, por decisão de Eliab (19/08/2026).
 *
 * > *Elas vão para a NF-e quando o FIS existir; sigla inventada agora custa migração depois.*
 *
 * ⚠️ **Uma ressalva de procedência, para ninguém escrever "tabela oficial" sem conferir:** no layout
 * da NF-e, a **unidade comercial** (`uCom`) é texto livre de até 6 caracteres — não há tabela que a
 * SEFAZ valide. O que TEM tabela fechada é a **unidade tributável** (`uTrib`) de exportação, que é
 * outro campo. Portanto esta lista é o **conjunto convencional** usado no mercado (e o que os ERPs
 * de referência oferecem), adotado aqui por qualidade de dado, não por exigência fiscal.
 *
 * A consequência prática da escolha é boa nas duas direções: escrever "UNID" ou "unidade" hoje
 * geraria um cadastro que depois teria de ser normalizado à mão em cada linha; e se o FIS precisar
 * de uma sigla fora daqui, acrescentá-la é uma linha nesta lista — não uma migração de dados.
 */
export const COMMERCIAL_UNITS = [
  'UN', // unidade
  'PC', // peça
  'CX', // caixa
  'PCT', // pacote
  'FD', // fardo
  'KIT', // conjunto (é a UNIDADE "kit", não o formato `bundle` — ver PRODUCT_FORMATS)
  'DZ', // dúzia
  'PAR', // par
  'KG', // quilograma
  'G', // grama
  'MG', // miligrama
  'TON', // tonelada
  'L', // litro
  'ML', // mililitro
  'M', // metro
  'CM', // centímetro
  'MM', // milímetro
  'M2', // metro quadrado
  'M3', // metro cúbico
  'ROL', // rolo
  'SC', // saco
  'GL', // galão
  'AMP', // ampola
  'FR', // frasco
  'TB', // tubo
  'H', // hora (serviços)
  'MES', // mês (serviços)
  'DIA', // dia (serviços)
] as const;

export type CommercialUnit = (typeof COMMERCIAL_UNITS)[number];

/**
 * ORIGEM da mercadoria — este SIM é tabela fechada da NF-e (campo `orig`, 0 a 8).
 *
 * É dado DO PRODUTO, não regra de módulo: a origem descreve a mercadoria, e vale igual em qualquer
 * operação. Diferente do CFOP, que depende da natureza da operação e por isso **não existe aqui**.
 */
export const PRODUCT_ORIGINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type ProductOrigin = (typeof PRODUCT_ORIGINS)[number];

export const PRODUCT_ORIGIN_LABEL: Record<ProductOrigin, string> = {
  '0': '0 — Nacional, exceto as indicadas nos códigos 3 a 5',
  '1': '1 — Estrangeira, importação direta, exceto a indicada no código 6',
  '2': '2 — Estrangeira, adquirida no mercado interno, exceto a indicada no código 7',
  '3': '3 — Nacional, com conteúdo de importação superior a 40% e até 70%',
  '4': '4 — Nacional, produção conforme processos produtivos básicos',
  '5': '5 — Nacional, com conteúdo de importação inferior ou igual a 40%',
  '6': '6 — Estrangeira, importação direta, sem similar nacional (lista CAMEX)',
  '7': '7 — Estrangeira, adquirida no mercado interno, sem similar nacional (lista CAMEX)',
  '8': '8 — Nacional, com conteúdo de importação superior a 70%',
};

export const PRODUCT_FORMAT_LABEL: Record<ProductFormat, string> = {
  simple: 'Simples',
  bundle: 'Kit',
  variant: 'Com variações',
};

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = {
  product: 'Produto',
  service: 'Serviço',
};

export const PRODUCT_CONDITION_LABEL: Record<ProductCondition, string> = {
  new: 'Novo',
  used: 'Usado',
};

export class InvalidProductFormatException extends DomainException {}

export class ProductFormatNotAvailableException extends DomainException {}

export class InvalidProductKindException extends DomainException {}

export class InvalidProductConditionException extends DomainException {}

export class InvalidCommercialUnitException extends DomainException {}

export class InvalidProductOriginException extends DomainException {}

/**
 * Valida o formato e **recusa o que não está implementado**, com a mensagem dizendo o que falta.
 *
 * A mensagem nomeia o módulo de propósito: "formato inválido" faria o operador tentar de novo;
 * "kit depende do módulo de Estoque" diz por que não dá e quando vai dar.
 */
export function parseProductFormat(value: string): ProductFormat {
  const normalized = value.trim().toLowerCase();
  if (!PRODUCT_FORMATS.includes(normalized as ProductFormat)) {
    throw new InvalidProductFormatException(
      `Formato de produto desconhecido: ${value}. Use ${CREATABLE_PRODUCT_FORMATS.join(', ')}.`,
    );
  }

  const format = normalized as ProductFormat;
  if (!CREATABLE_PRODUCT_FORMATS.includes(format)) {
    throw new ProductFormatNotAvailableException(
      format === 'bundle'
        ? 'Kit ainda não está disponível: a composição só faz sentido com o módulo de Estoque, ' +
            'que baixa os componentes ao vender. Cadastre os itens como produtos simples.'
        : 'Produto com variações ainda não está disponível: depende do módulo de Catálogo.',
    );
  }
  return format;
}

export function parseProductKind(value: string): ProductKind {
  const normalized = value.trim().toLowerCase();
  if (!PRODUCT_KINDS.includes(normalized as ProductKind)) {
    throw new InvalidProductKindException('Tipo deve ser "product" ou "service".');
  }
  return normalized as ProductKind;
}

export function parseProductCondition(value: string): ProductCondition {
  const normalized = value.trim().toLowerCase();
  if (!PRODUCT_CONDITIONS.includes(normalized as ProductCondition)) {
    throw new InvalidProductConditionException('Condição deve ser "new" ou "used".');
  }
  return normalized as ProductCondition;
}

/**
 * A unidade é normalizada para MAIÚSCULA antes de validar.
 *
 * "un", "Un" e "UN" são a mesma unidade, e guardar as três formas produziria três grupos numa
 * listagem por unidade — o tipo de sujeira que só aparece no relatório, meses depois.
 */
export function parseCommercialUnit(value: string): CommercialUnit {
  const normalized = value.trim().toUpperCase();
  if (!COMMERCIAL_UNITS.includes(normalized as CommercialUnit)) {
    throw new InvalidCommercialUnitException(
      `Unidade "${value}" não é reconhecida. Use uma das siglas: ${COMMERCIAL_UNITS.join(', ')}.`,
    );
  }
  return normalized as CommercialUnit;
}

export function parseProductOrigin(value: string): ProductOrigin {
  const normalized = value.trim();
  if (!PRODUCT_ORIGINS.includes(normalized as ProductOrigin)) {
    throw new InvalidProductOriginException('Origem da mercadoria deve ser um código de 0 a 8.');
  }
  return normalized as ProductOrigin;
}
