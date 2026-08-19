import { MODULES } from '../../module/domain/modules.catalog';
import { Product } from './entities/product.entity';

/**
 * COMPLETUDE POR FINALIDADE — o widget do §3.5, e o cuidado que ele exige.
 *
 * O §3.5 pede que a tela diga **para o que o cadastro serve hoje**:
 *
 * > *pesos/dimensões/volumes/itens por caixa (**obrigatórios p/ cotação de frete — widget "validação
 * > do produto" indica completude por finalidade**)*
 *
 * ## A distinção que faz este arquivo existir
 *
 * Duas das três finalidades dependem de módulos que **não existem**. E há uma diferença
 * categórica entre duas frases que parecem a mesma:
 *
 * | Frase | O que ela afirma | Verdadeira hoje? |
 * |---|---|---|
 * | *"pronto para emissão fiscal"* | uma afirmação sobre **o sistema** | **NÃO** — sem o FIS não há emissão nenhuma |
 * | *"campos fiscais preenchidos"* | uma afirmação sobre **o cadastro** | sim, é verificável agora |
 *
 * A primeira é da mesma família do limite de crédito do Contato: promete comportamento que não
 * existe, e ninguém lê comentário de código. Redação decidida por Eliab em 19/08/2026 — a segunda
 * forma, sempre, com o aviso de qual módulo falta.
 *
 * ## O aviso desaparece sozinho
 *
 * `moduloNecessario` é comparado com os **módulos ativos da conta** (que chegam do token). No dia em
 * que o FIS for ativado, a mesma função passa a devolver `pendenciaDeModulo: null` e a tela para de
 * avisar — sem ninguém editar texto. É o mesmo desenho do `hint` do limite de crédito.
 */

export type ProductPurposeCode = 'sale' | 'freight' | 'fiscal';

export interface ProductPurposeStatus {
  purpose: ProductPurposeCode;
  /** O rótulo é sobre o CADASTRO, nunca sobre a capacidade do sistema. */
  label: string;
  /** Todos os campos da finalidade estão preenchidos? */
  complete: boolean;
  /** Os campos que faltam, com nome de tela — é o que torna o widget acionável. */
  missing: string[];
  /**
   * O módulo que executaria esta finalidade, quando ele NÃO está ativo. `null` quando a finalidade
   * não depende de módulo nenhum (frete) ou quando o módulo já está ativo.
   */
  pendenciaDeModulo: { code: string; message: string } | null;
}

interface DefinicaoFinalidade {
  purpose: ProductPurposeCode;
  label: string;
  /** O módulo que dá SENTIDO à finalidade. `null` = nenhum módulo necessário. */
  moduloNecessario: string | null;
  /** A frase exibida quando o módulo falta — diz o que o cadastro é, e o que ele ainda não faz. */
  avisoSemModulo: string;
  campos: (product: Product) => { label: string; preenchido: boolean }[];
}

const FINALIDADES: DefinicaoFinalidade[] = [
  {
    purpose: 'sale',
    label: 'Campos de venda preenchidos',
    moduloNecessario: MODULES.VND,
    avisoSemModulo: 'Vender depende do módulo de Vendas, que não está disponível nesta conta.',
    campos: (product) => [
      { label: 'Nome', preenchido: product.name.trim().length >= 2 },
      { label: 'Unidade', preenchido: Boolean(product.unit) },
      { label: 'Preço de venda', preenchido: product.basePrice !== null },
    ],
  },
  {
    /*
     * A ÚNICA finalidade verificável de ponta a ponta hoje, e é a razão de o widget não ser enfeite:
     * peso e dimensão são dados DO PRODUTO, e uma cotação de frete precisa exatamente deles. Não há
     * módulo ausente entre o cadastro e o resultado.
     */
    purpose: 'freight',
    label: 'Dados completos para cotação de frete',
    moduloNecessario: null,
    avisoSemModulo: '',
    campos: (product) => [
      { label: 'Peso bruto', preenchido: product.measures.grossWeightKg !== null },
      { label: 'Largura', preenchido: product.measures.widthCm !== null },
      { label: 'Altura', preenchido: product.measures.heightCm !== null },
      { label: 'Comprimento', preenchido: product.measures.lengthCm !== null },
    ],
  },
  {
    purpose: 'fiscal',
    // NUNCA "pronto para emissão fiscal" — ver o cabeçalho deste arquivo.
    label: 'Campos fiscais preenchidos',
    moduloNecessario: MODULES.FIS,
    avisoSemModulo:
      'A emissão fiscal depende do módulo Fiscal, que não está disponível nesta conta.',
    campos: (product) => [
      { label: 'Origem da mercadoria', preenchido: product.tax.origin !== null },
      { label: 'NCM', preenchido: product.tax.ncm !== null },
      { label: 'GTIN/EAN', preenchido: product.barcode !== null },
    ],
  },
];

/**
 * @param activeModules os módulos ativos da conta — vêm do TOKEN, nunca do corpo da requisição
 */
export function avaliarCompletude(
  product: Product,
  activeModules: readonly string[],
): ProductPurposeStatus[] {
  return FINALIDADES.map((definicao) => {
    const campos = definicao.campos(product);
    const missing = campos.filter((campo) => !campo.preenchido).map((campo) => campo.label);
    const moduloAtivo =
      definicao.moduloNecessario === null || activeModules.includes(definicao.moduloNecessario);

    return {
      purpose: definicao.purpose,
      label: definicao.label,
      complete: missing.length === 0,
      missing,
      pendenciaDeModulo: moduloAtivo
        ? null
        : { code: definicao.moduloNecessario as string, message: definicao.avisoSemModulo },
    };
  });
}

/**
 * Serviço não tem peso nem dimensão, e cobrar isso dele seria inventar requisito.
 *
 * Exposto separado para a tela poder esconder a finalidade em vez de mostrá-la eternamente
 * incompleta — um indicador que nunca fica verde é um indicador que se aprende a ignorar.
 */
export function finalidadeSeAplica(product: Product, purpose: ProductPurposeCode): boolean {
  if (purpose === 'freight') {
    return product.kind === 'product';
  }
  return true;
}
