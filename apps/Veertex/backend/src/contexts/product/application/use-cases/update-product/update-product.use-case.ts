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
import { ProductId } from '../../../domain/value-objects/product-id.vo';
import { ProductDto } from '../../dto/product.dto';
import {
  DuplicateProductBarcodeException,
  DuplicateProductSkuException,
  ProductNotFoundException,
  SupplierMustBeContactException,
} from '../../../domain/exceptions/product-exceptions';
import { paraDominio, ProductInput } from '../product-input';
import { validarFornecedores } from '../validar-fornecedores';
import { RequiredFieldsChecker } from '../../../../field-config/application/required-fields.checker';

export class UpdateProductCommand {
  constructor(
    public readonly productId: string,
    /** Módulos ativos, do TOKEN. */
    public readonly activeModules: readonly string[],
    /**
     * Parcial de propósito: campo ausente significa "não mexa", campo `null` significa "apague".
     * Trocar um pelo outro apagaria dado que ninguém pediu para apagar — ver `paraDominio`.
     */
    public readonly input: Partial<ProductInput> & { active?: boolean },
  ) {}
}

/**
 * Edita um produto.
 *
 * **O formato não está aqui**, e a ausência é a decisão: converter `simple` em `bundle` num produto
 * com histórico o transformaria numa estrutura de composição que não existe (o kit voltou inteiro
 * para o EST). Quando o módulo chegar, a conversão será operação própria, com regra sua.
 *
 * As duas checagens de unicidade **ignoram o próprio produto** (`exceptId`). Sem isso, salvar um
 * produto sem alterar o SKU acusaria conflito consigo mesmo — o erro que faz o usuário achar que o
 * sistema perdeu o dado dele.
 */
@Injectable()
export class UpdateProductUseCase implements UseCase<UpdateProductCommand, ProductDto> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepositoryPort,
    @Inject(SUPPLIER_LOOKUP) private readonly suppliers: SupplierLookupPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    private readonly requiredFields: RequiredFieldsChecker,
  ) {}

  async execute(command: UpdateProductCommand): Promise<ProductDto> {
    return this.uow.execute(async () => {
      const id = ProductId.from(command.productId);
      const product = await this.products.findById(id);
      if (!product) {
        throw new ProductNotFoundException(command.productId);
      }

      // Obrigatório dinâmico, modo `update`: só cobra os campos mencionados no payload.
      await this.requiredFields.assertRequiredPresent('product', { ...command.input }, 'update');

      product.update({ ...paraDominio(command.input), active: command.input.active });

      if (product.sku && (await this.products.findBySku(product.sku, id))) {
        throw new DuplicateProductSkuException(product.sku);
      }
      if (product.barcode && (await this.products.findByBarcode(product.barcode, id))) {
        throw new DuplicateProductBarcodeException(product.barcode);
      }

      const nomes = await validarFornecedores(this.suppliers, product.suppliers, (mensagem) => {
        throw new SupplierMustBeContactException(mensagem);
      });

      return ProductDto.fromDomain(await this.products.save(product), command.activeModules, nomes);
    });
  }
}
