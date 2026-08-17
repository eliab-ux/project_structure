import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidValueException } from '../../../../shared/domain/exceptions/invalid-value.exception';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { ProductTypeId } from '../value-objects/product-type-id.vo';

/**
 * Tipo de produto: camisa, camiseta, pijama, scrub, maiô, calça, jaleco, avental cirúrgico,
 * macacão (spec §4.6). Cadastro simples; alimenta o campo "tipos de produtos cortados" do
 * relatório mensal.
 */
export class ProductType extends AggregateRoot {
  private constructor(
    private readonly _id: ProductTypeId,
    private readonly _accountId: AccountId,
    private _name: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(input: { accountId: AccountId; name: string }): ProductType {
    const now = new Date();
    return new ProductType(
      ProductTypeId.create(),
      input.accountId,
      ProductType.assertName(input.name),
      now,
      now,
    );
  }

  static restore(input: {
    id: ProductTypeId;
    accountId: AccountId;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }): ProductType {
    return new ProductType(input.id, input.accountId, input.name, input.createdAt, input.updatedAt);
  }

  rename(name: string): void {
    this._name = ProductType.assertName(name);
    this._updatedAt = new Date();
  }

  private static assertName(name: string): string {
    const value = (name ?? '').trim();
    if (value.length < 2 || value.length > 120) {
      throw new InvalidValueException('Nome do produto deve ter entre 2 e 120 caracteres.');
    }
    return value;
  }

  get id(): ProductTypeId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get name(): string {
    return this._name;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
