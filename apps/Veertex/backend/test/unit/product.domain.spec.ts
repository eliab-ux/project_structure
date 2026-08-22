import { Product } from '../../src/contexts/product/domain/entities/product.entity';
import {
  avaliarCompletude,
  finalidadeSeAplica,
} from '../../src/contexts/product/domain/product-completeness';
import {
  CREATABLE_PRODUCT_FORMATS,
  InvalidCommercialUnitException,
  ProductFormatNotAvailableException,
} from '../../src/contexts/product/domain/product-types';
import {
  DuplicateDefaultSupplierException,
  DuplicateProductSupplierException,
  InvalidProductMeasureException,
  InvalidProductStockParamsException,
} from '../../src/contexts/product/domain/exceptions/product-exceptions';
import { PRODUCT_FIELD_CATALOG } from '../../src/contexts/product/domain/product-field.catalog';

/**
 * PRODUTO — as invariantes que ninguém vê quebrar.
 *
 * O que este arquivo prende não é "o produto salva". É o conjunto de decisões do §3.5 que, se
 * silenciosamente revertidas num refactor, produziriam dado plausível e errado:
 *
 *  - kit e variação RECUSADOS na criação, com a mensagem que diz de qual módulo dependem;
 *  - a unidade sai da lista fechada, normalizada em maiúscula;
 *  - peso bruto menor que o líquido é impossível (os campos trocados são o erro mais comum);
 *  - o widget de completude fala do CADASTRO, e avisa qual módulo falta — nunca promete emissão.
 */
function produtoBase(overrides: Partial<Parameters<typeof Product.create>[0]> = {}) {
  return Product.create({
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Parafuso sextavado M8',
    unit: 'un',
    ...overrides,
  });
}

describe('Product — formato', () => {
  it('permite criar produto simples e KIT (bundle voltou com o EST, 22/08/2026)', () => {
    expect([...CREATABLE_PRODUCT_FORMATS]).toEqual(['simple', 'bundle']);
    expect(produtoBase().format).toBe('simple');
    expect(produtoBase({ format: 'bundle' }).format).toBe('bundle');
  });

  it('RECUSA variação (fora até o CAN)', () => {
    expect(() => produtoBase({ format: 'variant' })).toThrow(ProductFormatNotAvailableException);
  });

  it('não permite converter o formato na edição', () => {
    const product = produtoBase();
    // `update` não tem `format` no tipo; o teste prende o COMPORTAMENTO, para o caso de alguém
    // acrescentar o campo sem pensar na conversão de um produto com histórico.
    product.update({ name: 'Outro nome' } as never);
    expect(product.format).toBe('simple');
  });
});

describe('Product — unidade comercial', () => {
  it('normaliza para maiúscula', () => {
    expect(produtoBase({ unit: 'cx' }).unit).toBe('CX');
    expect(produtoBase({ unit: ' Kg ' }).unit).toBe('KG');
  });

  it('recusa sigla fora da lista, listando as aceitas', () => {
    expect(() => produtoBase({ unit: 'UNID' })).toThrow(InvalidCommercialUnitException);
    expect(() => produtoBase({ unit: 'UNID' })).toThrow(/UN, PC, CX/);
  });
});

describe('Product — medidas', () => {
  it('recusa peso bruto menor que o líquido e sugere a troca de campos', () => {
    expect(() => produtoBase({ measures: { netWeightKg: 2, grossWeightKg: 1 } })).toThrow(
      /podem estar trocados/,
    );
  });

  it('aceita bruto igual ao líquido (item sem embalagem própria)', () => {
    const product = produtoBase({ measures: { netWeightKg: 1.5, grossWeightKg: 1.5 } });
    expect(product.measures.grossWeightKg).toBe(1.5);
  });

  it('recusa medida zero ou negativa — ausência é null, não zero', () => {
    expect(() => produtoBase({ measures: { widthCm: 0 } })).toThrow(InvalidProductMeasureException);
    expect(() => produtoBase({ measures: { heightCm: -1 } })).toThrow(
      InvalidProductMeasureException,
    );
    expect(produtoBase().measures.widthCm).toBeNull();
  });

  it('mantém três casas — 0,125 kg não pode virar 0,13', () => {
    expect(produtoBase({ measures: { netWeightKg: 0.125 } }).measures.netWeightKg).toBe(0.125);
  });
});

describe('Product — parâmetros de estoque', () => {
  it('recusa máximo abaixo do mínimo', () => {
    expect(() => produtoBase({ stockParams: { minimumQuantity: 10, maximumQuantity: 5 } })).toThrow(
      InvalidProductStockParamsException,
    );
  });

  it('não tem saldo — parâmetro é do produto, quantidade é do EST', () => {
    const product = produtoBase({ stockParams: { minimumQuantity: 2 } });
    expect(product.stockParams.minimumQuantity).toBe(2);
    expect(product as unknown as Record<string, unknown>).not.toHaveProperty('_stockQuantity');
  });
});

describe('Product — fornecedores', () => {
  const contatoA = '22222222-2222-4222-8222-222222222222';
  const contatoB = '33333333-3333-4333-8333-333333333333';

  it('recusa o mesmo fornecedor duas vezes', () => {
    expect(() =>
      produtoBase({ suppliers: [{ contactId: contatoA }, { contactId: contatoA }] }),
    ).toThrow(DuplicateProductSupplierException);
  });

  it('recusa dois fornecedores padrão', () => {
    expect(() =>
      produtoBase({
        suppliers: [
          { contactId: contatoA, isDefault: true },
          { contactId: contatoB, isDefault: true },
        ],
      }),
    ).toThrow(DuplicateDefaultSupplierException);
  });

  it('aceita um padrão entre vários', () => {
    const product = produtoBase({
      suppliers: [{ contactId: contatoA, isDefault: true, cost: 12.345 }, { contactId: contatoB }],
    });
    expect(product.suppliers).toHaveLength(2);
    // Custo é dinheiro: duas casas, senão a soma da tela não bate com a do banco.
    expect(product.suppliers[0].cost).toBe(12.35);
  });
});

describe('Product — tags e categoria', () => {
  it('normaliza tags: minúscula, sem duplicata, ordenadas', () => {
    expect(produtoBase({ tags: ['Promoção', 'promoção', ' Novo '] }).tags).toEqual([
      'novo',
      'promoção',
    ]);
  });

  it('guarda a categoria como caminho em texto, sem validar hierarquia', () => {
    // A árvore não existe: validar o formato aqui seria inventá-la no lugar errado.
    const product = produtoBase({ categoryPath: 'Ferramentas > Manuais' });
    expect(product.categoryPath).toBe('Ferramentas > Manuais');
  });
});

describe('Product — dados fiscais', () => {
  it('guarda NCM só com dígitos e exige 8', () => {
    expect(produtoBase({ tax: { ncm: '7318.15.00' } }).tax.ncm).toBe('73181500');
    expect(() => produtoBase({ tax: { ncm: '123' } })).toThrow(/NCM deve ter 8 dígitos/);
  });

  it('NÃO tem CFOP — §3.5, e a ausência é a decisão', () => {
    const product = produtoBase({ tax: { ncm: '73181500' } });
    expect(product.tax).not.toHaveProperty('cfop');
    expect(PRODUCT_FIELD_CATALOG.some((campo) => campo.field.toLowerCase().includes('cfop'))).toBe(
      false,
    );
  });
});

describe('Product — completude por finalidade (§3.5)', () => {
  const produtoCompleto = () =>
    produtoBase({
      basePrice: 10,
      barcode: '7891234567895',
      tax: { origin: '0', ncm: '73181500' },
      measures: { grossWeightKg: 1, widthCm: 10, heightCm: 5, lengthCm: 20 },
    });

  it('NUNCA diz "pronto para emissão fiscal" — fala do cadastro', () => {
    const [venda, , fiscal] = avaliarCompletude(produtoCompleto(), []);
    expect(fiscal.label).toBe('Campos fiscais preenchidos');
    expect(fiscal.label).not.toMatch(/pronto para/i);
    expect(venda.label).toBe('Campos de venda preenchidos');
    expect(venda.label).not.toMatch(/pronto para/i);
  });

  it('avisa qual módulo falta quando ele não está ativo', () => {
    const [venda, frete, fiscal] = avaliarCompletude(produtoCompleto(), []);
    expect(fiscal.pendenciaDeModulo?.code).toBe('FIS');
    expect(fiscal.pendenciaDeModulo?.message).toMatch(/módulo Fiscal/);
    expect(venda.pendenciaDeModulo?.code).toBe('VND');
    // Frete não depende de módulo nenhum — é a única finalidade completa de ponta a ponta hoje.
    expect(frete.pendenciaDeModulo).toBeNull();
  });

  it('o aviso SOME quando o módulo é ativado, sem ninguém editar texto', () => {
    const [, , fiscal] = avaliarCompletude(produtoCompleto(), ['FIS']);
    expect(fiscal.pendenciaDeModulo).toBeNull();
    expect(fiscal.complete).toBe(true);
  });

  it('lista o que falta, com nome de tela', () => {
    const [, frete] = avaliarCompletude(produtoBase(), []);
    expect(frete.complete).toBe(false);
    expect(frete.missing).toEqual(['Peso bruto', 'Largura', 'Altura', 'Comprimento']);
  });

  it('serviço não é cobrado por peso e dimensão', () => {
    const servico = produtoBase({ kind: 'service', unit: 'H' });
    expect(finalidadeSeAplica(servico, 'freight')).toBe(false);
    expect(finalidadeSeAplica(servico, 'fiscal')).toBe(true);
  });
});

describe('Catálogo de campos — o default é declarado, nunca inferido', () => {
  it('todo campo declara visibilidade e obrigatoriedade', () => {
    for (const campo of PRODUCT_FIELD_CATALOG) {
      expect(typeof campo.defaultVisible).toBe('boolean');
      expect(typeof campo.defaultRequired).toBe('boolean');
      expect(campo.label.length).toBeGreaterThan(1);
    }
  });

  it('o bloco fiscal começa oculto — sem o FIS, ele só atrapalha quem não emite nota', () => {
    const fiscais = PRODUCT_FIELD_CATALOG.filter((campo) => campo.group === 'tax');
    expect(fiscais.length).toBeGreaterThan(0);
    expect(fiscais.every((campo) => campo.defaultVisible === false)).toBe(true);
  });

  it('as medidas começam VISÍVEIS — é a única finalidade verificável hoje', () => {
    const medidas = PRODUCT_FIELD_CATALOG.filter((campo) => campo.group === 'measures');
    const principais = medidas.filter((campo) =>
      ['grossWeightKg', 'widthCm', 'heightCm', 'lengthCm'].includes(campo.field),
    );
    expect(principais).toHaveLength(4);
    expect(principais.every((campo) => campo.defaultVisible)).toBe(true);
  });

  it('campos que não fazem nada hoje carregam aviso na tela', () => {
    // Mesma regra do limite de crédito do contato: ninguém lê comentário de código.
    const comAviso = ['minimumQuantity', 'taxGroup', 'categoryPath', 'basePrice'];
    for (const nome of comAviso) {
      const campo = PRODUCT_FIELD_CATALOG.find((item) => item.field === nome);
      // O nome do campo entra na asserção para a falha dizer QUAL deles perdeu o aviso.
      expect({ campo: nome, hint: campo?.hint ?? null }).toEqual({
        campo: nome,
        hint: expect.any(String),
      });
    }
  });
});
