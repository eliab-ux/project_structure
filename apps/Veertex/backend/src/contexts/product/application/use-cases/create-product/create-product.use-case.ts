import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  PRODUCT_REPOSITORY,
  ProductRepositoryPort,
} from '../../ports/output/product-repository.port';
import { SUPPLIER_LOOKUP, SupplierLookupPort } from '../../ports/output/supplier-lookup.port';
import { Product } from '../../../domain/entities/product.entity';
import { ProductDto } from '../../dto/product.dto';
import {
  DuplicateProductBarcodeException,
  DuplicateProductSkuException,
  SupplierMustBeContactException,
} from '../../../domain/exceptions/product-exceptions';
import { paraDominio, ProductInput } from '../product-input';
import { validarFornecedores } from '../validar-fornecedores';
import { RequiredFieldsChecker } from '../../../../field-config/application/required-fields.checker';

export class CreateProductCommand {
  constructor(
    public readonly accountId: string,
    /** Módulos ativos, do TOKEN — decidem o aviso de módulo ausente no widget de completude. */
    public readonly activeModules: readonly string[],
    public readonly input: ProductInput,
  ) {}
}

/**
 * Cria um produto.
 *
 * ## SKU e GTIN únicos por conta
 *
 * A numeração é **manual** (decisão de Eliab, 19/08/2026 — a mesma do código do Contato), e manual
 * sem unicidade produz dois produtos com o mesmo código. Igual ao Contato, a checagem roda **dentro
 * da transação** da escrita e existe para a mensagem ser de negócio; quem de fato fecha a corrida
 * entre duas requisições simultâneas é o índice único no banco.
 *
 * ## O fornecedor tem de ser um contato FORNECEDOR
 *
 * O §3.5 pede N fornecedores por produto, e a decisão de 19/08 foi referenciar `contact` com o tipo
 * `supplier`. Validar o tipo aqui não é preciosismo: um vínculo com um contato que é só cliente é
 * dado que ninguém consegue explicar depois — e a tela de compras futura o trataria como fonte de
 * cotação.
 */
@Injectable()
export class CreateProductUseCase implements UseCase<CreateProductCommand, ProductDto> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(SUPPLIER_LOOKUP) private readonly suppliers: SupplierLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly requiredFields: RequiredFieldsChecker,
  ) {}

  async execute(command: CreateProductCommand): Promise<ProductDto> {
    return this.uow.execute(async () => {
      // Obrigatório dinâmico do §3.6 (§7.5): rejeita o payload sem um campo que a conta marcou
      // obrigatório. O `ProductInput` é plano e usa os mesmos nomes do catálogo.
      await this.requiredFields.assertRequiredPresent('product', { ...command.input }, 'create');

      const product = Product.create({
        accountId: command.accountId,
        format: command.input.format,
        ...paraDominio(command.input),
        // `paraDominio` devolve `name` e `unit` como opcionais (a edição não exige nenhum dos dois);
        // na CRIAÇÃO os dois são obrigatórios, e o DTO de request já os garantiu.
        name: command.input.name,
        unit: command.input.unit,
      });

      // Depois de construir: o domínio já normalizou (maiúsculas na unidade, dígitos no NCM), e é o
      // valor normalizado que precisa ser comparado com o banco.
      if (product.sku && (await this.products.findBySku(product.sku))) {
        throw new DuplicateProductSkuException(product.sku);
      }
      if (product.barcode && (await this.products.findByBarcode(product.barcode))) {
        throw new DuplicateProductBarcodeException(product.barcode);
      }

      const nomes = await validarFornecedores(this.suppliers, product.suppliers, (mensagem) => {
        throw new SupplierMustBeContactException(mensagem);
      });

      return ProductDto.fromDomain(await this.products.save(product), command.activeModules, nomes);
    });
  }
}
