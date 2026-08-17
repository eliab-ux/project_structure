import { Fabric } from '../../../domain/entities/fabric.entity';
import { ProductType } from '../../../domain/entities/product-type.entity';
import { FabricId } from '../../../domain/value-objects/fabric-id.vo';
import { ProductTypeId } from '../../../domain/value-objects/product-type-id.vo';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';

export const FABRIC_REPOSITORY = Symbol('FABRIC_REPOSITORY');
export const PRODUCT_TYPE_REPOSITORY = Symbol('PRODUCT_TYPE_REPOSITORY');

export interface FabricRepositoryPort {
  listByAccount(accountId: AccountId): Promise<Fabric[]>;
  findById(accountId: AccountId, id: FabricId): Promise<Fabric | null>;
  findByName(accountId: AccountId, name: string): Promise<Fabric | null>;
  save(fabric: Fabric): Promise<Fabric>;
}

export interface ProductTypeRepositoryPort {
  listByAccount(accountId: AccountId): Promise<ProductType[]>;
  findById(accountId: AccountId, id: ProductTypeId): Promise<ProductType | null>;
  findByName(accountId: AccountId, name: string): Promise<ProductType | null>;
  save(productType: ProductType): Promise<ProductType>;
}
