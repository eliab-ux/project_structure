import { CreateProductUseCase } from '../../src/contexts/product/application/use-cases/create-product/create-product.use-case';
import { CreateProductCommand } from '../../src/contexts/product/application/use-cases/create-product/create-product.use-case';
import { UpdateProductUseCase } from '../../src/contexts/product/application/use-cases/update-product/update-product.use-case';
import { UpdateProductCommand } from '../../src/contexts/product/application/use-cases/update-product/update-product.use-case';
import { Product } from '../../src/contexts/product/domain/entities/product.entity';
import { ProductRepositoryPort } from '../../src/contexts/product/application/ports/output/product-repository.port';
import {
  SupplierInfo,
  SupplierLookupPort,
} from '../../src/contexts/product/application/ports/output/supplier-lookup.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import { RequiredFieldsChecker } from '../../src/contexts/field-config/application/required-fields.checker';
import {
  DuplicateProductSkuException,
  ProductNotFoundException,
  SupplierMustBeContactException,
} from '../../src/contexts/product/domain/exceptions/product-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const FORNECEDOR = '33333333-3333-4333-8333-333333333333';

/**
 * Os use cases do produto — as regras que precisam do BANCO para serem verificadas, e por isso não
 * podem viver na entidade.
 *
 * O centro deste arquivo é o vínculo com fornecedor: *"o contato existe e tem o tipo `supplier`?"* é
 * pergunta que só o repositório responde. E ela é verificada nos DOIS caminhos — criação e edição —
 * porque a porta mais frouxa é a que o dado ruim encontra. Uma edição que aceitasse o que a criação
 * recusa seria exatamente esse buraco.
 */
function repositorioFalso(inicial: Product[] = []) {
  const salvos = [...inicial];
  const repo: ProductRepositoryPort = {
    findById: async (id) => salvos.find((p) => p.id.value === id.value) ?? null,
    findBySku: async (sku, exceptId) =>
      salvos.find((p) => p.sku === sku && p.id.value !== exceptId?.value) ?? null,
    findByBarcode: async (barcode, exceptId) =>
      salvos.find((p) => p.barcode === barcode && p.id.value !== exceptId?.value) ?? null,
    list: async () => salvos,
    save: async (product) => {
      const indice = salvos.findIndex((p) => p.id.value === product.id.value);
      if (indice >= 0) {
        salvos[indice] = product;
      } else {
        salvos.push(product);
      }
      return product;
    },
  };
  return { repo, salvos };
}

/** O lookup responde como o de verdade: contato inexistente **não aparece no mapa**. */
function lookupFalso(): SupplierLookupPort {
  const base = new Map<string, SupplierInfo>([
    [CLIENTE, { name: 'Padaria do Zé', isSupplier: false }],
    [FORNECEDOR, { name: 'Aços Brasil', isSupplier: true }],
  ]);
  return {
    findByIds: async (ids) => new Map([...base].filter(([id]) => ids.includes(id))),
  };
}

/** Unit of work que só executa — a transação de verdade é testada na integração. */
const uowFalso: UnitOfWorkPort = {
  execute: async (fn) => fn(),
} as UnitOfWorkPort;

/**
 * Checker de obrigatório que não cobra nada — a obrigatoriedade dinâmica tem teste próprio
 * (`field-config.spec.ts`). Aqui interessa a regra de fornecedor/SKU, não a de campo obrigatório.
 */
const checkerFalso = {
  assertRequiredPresent: async () => undefined,
} as unknown as RequiredFieldsChecker;

function entrada(overrides: Record<string, unknown> = {}) {
  return { name: 'Chapa de aço 2mm', unit: 'UN', ...overrides } as never;
}

describe('CreateProductUseCase', () => {
  it('cadastra produto simples e devolve o DTO com as finalidades avaliadas', async () => {
    const { repo, salvos } = repositorioFalso();
    const useCase = new CreateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const dto = await useCase.execute(new CreateProductCommand(CONTA, [], entrada()));

    expect(salvos).toHaveLength(1);
    expect(dto.name).toBe('Chapa de aço 2mm');
    expect(dto.unit).toBe('UN');
    // O widget do §3.5 viaja no DTO, e sem módulo ativo ele avisa qual falta.
    expect(dto.purposes.map((p) => p.purpose)).toEqual(['sale', 'freight', 'fiscal']);
    expect(dto.purposes.find((p) => p.purpose === 'fiscal')?.pendenciaDeModulo?.code).toBe('FIS');
  });

  it('recusa SKU repetido com mensagem de negócio', async () => {
    const primeiro = Product.create({
      accountId: CONTA,
      name: 'Chapa antiga',
      unit: 'UN',
      sku: 'CX-100',
    });
    const { repo } = repositorioFalso([primeiro]);
    const useCase = new CreateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    await expect(
      useCase.execute(new CreateProductCommand(CONTA, [], entrada({ sku: 'CX-100' }))),
    ).rejects.toThrow(DuplicateProductSkuException);
  });

  it('RECUSA fornecedor que não é fornecedor, e diz o que fazer', async () => {
    const { repo } = repositorioFalso();
    const useCase = new CreateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const promessa = useCase.execute(
      new CreateProductCommand(CONTA, [], entrada({ suppliers: [{ contactId: CLIENTE }] })),
    );

    await expect(promessa).rejects.toThrow(SupplierMustBeContactException);
    // A mensagem nomeia o contato e diz a ação: ajustar os tipos DELE, não tentar de novo aqui.
    await expect(promessa).rejects.toThrow(/Padaria do Zé/);
    await expect(promessa).rejects.toThrow(/tipos do contato/);
  });

  it('recusa fornecedor inexistente sem revelar se ele existe em outra conta', async () => {
    const { repo } = repositorioFalso();
    const useCase = new CreateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);
    const outraConta = '44444444-4444-4444-8444-444444444444';

    await expect(
      useCase.execute(
        new CreateProductCommand(CONTA, [], entrada({ suppliers: [{ contactId: outraConta }] })),
      ),
    ).rejects.toThrow(/não encontrado/);
  });

  it('aceita fornecedor válido e devolve o nome dele no DTO', async () => {
    const { repo } = repositorioFalso();
    const useCase = new CreateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const dto = await useCase.execute(
      new CreateProductCommand(
        CONTA,
        [],
        entrada({ suppliers: [{ contactId: FORNECEDOR, isDefault: true }] }),
      ),
    );

    expect(dto.suppliers).toHaveLength(1);
    // O nome vem resolvido para a tela não buscar contato por contato.
    expect(dto.suppliers[0].contactName).toBe('Aços Brasil');
    expect(dto.suppliers[0].isDefault).toBe(true);
  });
});

describe('UpdateProductUseCase', () => {
  it('não encontra produto de outra conta — mesma resposta de id inexistente', async () => {
    const { repo } = repositorioFalso();
    const useCase = new UpdateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    await expect(
      useCase.execute(
        new UpdateProductCommand('55555555-5555-4555-8555-555555555555', [], { name: 'X' }),
      ),
    ).rejects.toThrow(ProductNotFoundException);
  });

  it('a EDIÇÃO recusa o mesmo vínculo que a criação recusa', async () => {
    const existente = Product.create({ accountId: CONTA, name: 'Chapa base', unit: 'UN' });
    const { repo } = repositorioFalso([existente]);
    const useCase = new UpdateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    await expect(
      useCase.execute(
        new UpdateProductCommand(existente.id.value, [], {
          suppliers: [{ contactId: CLIENTE }],
        }),
      ),
    ).rejects.toThrow(SupplierMustBeContactException);
  });

  it('campo AUSENTE não apaga o que já estava gravado', async () => {
    /*
     * O caso que a função `paraDominio` existe para impedir: editar só o nome mandaria
     * `measures: { todos undefined }` ao domínio, que normalizaria tudo para `null` e **apagaria as
     * medidas** de quem só quis corrigir uma letra.
     */
    const existente = Product.create({
      accountId: CONTA,
      name: 'Chapa',
      unit: 'UN',
      measures: { grossWeightKg: 12.5, widthCm: 100 },
      tax: { ncm: '73181500' },
    });
    const { repo } = repositorioFalso([existente]);
    const useCase = new UpdateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const dto = await useCase.execute(
      new UpdateProductCommand(existente.id.value, [], { name: 'Chapa de aço' }),
    );

    expect(dto.name).toBe('Chapa de aço');
    expect(dto.grossWeightKg).toBe(12.5);
    expect(dto.widthCm).toBe(100);
    expect(dto.ncm).toBe('73181500');
  });

  it('campo NULO apaga — a distinção entre ausente e nulo é a semântica da edição', async () => {
    const existente = Product.create({
      accountId: CONTA,
      name: 'Chapa',
      unit: 'UN',
      basePrice: 99,
    });
    const { repo } = repositorioFalso([existente]);
    const useCase = new UpdateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const dto = await useCase.execute(
      new UpdateProductCommand(existente.id.value, [], { basePrice: null }),
    );

    expect(dto.basePrice).toBeNull();
  });

  it('desativa sem apagar — produto referenciado não pode desaparecer', async () => {
    const existente = Product.create({ accountId: CONTA, name: 'Chapa', unit: 'UN' });
    const { repo } = repositorioFalso([existente]);
    const useCase = new UpdateProductUseCase(repo, lookupFalso(), uowFalso, checkerFalso);

    const dto = await useCase.execute(
      new UpdateProductCommand(existente.id.value, [], { active: false }),
    );

    expect(dto.active).toBe(false);
  });
});
