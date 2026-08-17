import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_TYPE_REPOSITORY,
  ProductTypeRepositoryPort,
} from '../ports/output/catalog-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ProductTypeDto } from '../dto/catalog.dto';
import { ProductType } from '../../domain/entities/product-type.entity';
import {
  CatalogNameAlreadyInUseException,
  ProductTypeNotFoundException,
} from '../../domain/exceptions/catalog.exceptions';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { ProductTypeId } from '../../domain/value-objects/product-type-id.vo';

@Injectable()
export class ProductTypeUseCases {
  constructor(
    @Inject(PRODUCT_TYPE_REPOSITORY)
    private readonly productTypeRepository: ProductTypeRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async list(accountId: string): Promise<ProductTypeDto[]> {
    const types = await this.productTypeRepository.listByAccount(AccountId.from(accountId));
    return types.map(ProductTypeDto.fromDomain);
  }

  async create(accountId: string, name: string): Promise<ProductTypeDto> {
    const account = AccountId.from(accountId);

    const productType = ProductType.create({ accountId: account, name });
    await this.assertNameIsFree(account, productType.name, null);

    return this.unitOfWork.execute(async () => {
      const saved = await this.productTypeRepository.save(productType);
      return ProductTypeDto.fromDomain(saved);
    });
  }

  async update(accountId: string, productTypeId: string, name: string): Promise<ProductTypeDto> {
    const account = AccountId.from(accountId);

    const productType = await this.productTypeRepository.findById(
      account,
      ProductTypeId.from(productTypeId),
    );
    if (!productType) {
      throw new ProductTypeNotFoundException();
    }

    productType.rename(name);
    await this.assertNameIsFree(account, productType.name, productType.id.value);

    return this.unitOfWork.execute(async () => {
      const saved = await this.productTypeRepository.save(productType);
      return ProductTypeDto.fromDomain(saved);
    });
  }

  private async assertNameIsFree(
    accountId: AccountId,
    name: string,
    ownId: string | null,
  ): Promise<void> {
    const existing = await this.productTypeRepository.findByName(accountId, name);
    if (existing && existing.id.value !== ownId) {
      throw new CatalogNameAlreadyInUseException('tipo de produto');
    }
  }
}
