import { AggregateRoot } from '@gitspread/domain-primitives';
import { ProductId } from '../value-objects/product-id.vo';
import { SKU } from '../value-objects/sku.vo';
import { Price } from '../value-objects/price.vo';
import { Stock } from '../value-objects/stock.vo';
import { ProductCreatedEvent } from '../events/product-created.event';
import { StockUpdatedEvent } from '../events/stock-updated.event';

export class Product extends AggregateRoot {
  private constructor(
    private readonly _id: ProductId,
    private readonly _sku: SKU,
    private _name: string,
    private _description: string,
    private _price: Price,
    private _costPrice: Price,
    private _stock: Stock,
    private _categoryName: string | null,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _weight: number,
    private _width: number,
    private _height: number,
    private _length: number,
  ) {
    super();
  }

  static create(
    sku: SKU,
    name: string,
    description: string,
    price: Price,
    costPrice: Price,
    stock: Stock,
    categoryName?: string,
    weight = 0,
    width = 0,
    height = 0,
    length = 0,
  ): Product {
    const product = new Product(
      ProductId.generate(),
      sku,
      name,
      description,
      price,
      costPrice,
      stock,
      categoryName || null,
      true,
      new Date(),
      new Date(),
      weight,
      width,
      height,
      length,
    );

    product.addDomainEvent(new ProductCreatedEvent(product.id.value, sku.value, name));

    return product;
  }

  static reconstitute(
    id: ProductId,
    sku: SKU,
    name: string,
    description: string,
    price: Price,
    costPrice: Price,
    stock: Stock,
    categoryName: string | null,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
    weight: number,
    width: number,
    height: number,
    length: number,
  ): Product {
    return new Product(
      id,
      sku,
      name,
      description,
      price,
      costPrice,
      stock,
      categoryName,
      isActive,
      createdAt,
      updatedAt,
      weight,
      width,
      height,
      length,
    );
  }

  updateStock(newStock: Stock): void {
    if (this._stock.value !== newStock.value) {
      const previous = this._stock;
      this._stock = newStock;
      this._updatedAt = new Date();

      this.addDomainEvent(
        new StockUpdatedEvent(this._id.value, this._sku.value, previous.value, newStock.value),
      );
    }
  }

  updatePrice(newPrice: Price): void {
    this._price = newPrice;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  updateDetails(details: {
    name?: string;
    description?: string;
    costPrice?: Price;
    categoryName?: string | null;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
  }): void {
    let changed = false;

    if (details.name !== undefined && details.name !== this._name) {
      this._name = details.name;
      changed = true;
    }

    if (details.description !== undefined && details.description !== this._description) {
      this._description = details.description;
      changed = true;
    }

    if (details.costPrice !== undefined && details.costPrice.value !== this._costPrice.value) {
      this._costPrice = details.costPrice;
      changed = true;
    }

    if (details.categoryName !== undefined && details.categoryName !== this._categoryName) {
      this._categoryName = details.categoryName;
      changed = true;
    }

    if (details.weight !== undefined && details.weight !== this._weight) {
      this._weight = details.weight;
      changed = true;
    }

    if (details.width !== undefined && details.width !== this._width) {
      this._width = details.width;
      changed = true;
    }

    if (details.height !== undefined && details.height !== this._height) {
      this._height = details.height;
      changed = true;
    }

    if (details.length !== undefined && details.length !== this._length) {
      this._length = details.length;
      changed = true;
    }

    if (changed) {
      this._updatedAt = new Date();
    }
  }

  setActiveState(isActive: boolean): void {
    if (this._isActive !== isActive) {
      this._isActive = isActive;
      this._updatedAt = new Date();
    }
  }

  get id(): ProductId {
    return this._id;
  }

  get sku(): SKU {
    return this._sku;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get price(): Price {
    return this._price;
  }

  get costPrice(): Price {
    return this._costPrice;
  }

  get stock(): Stock {
    return this._stock;
  }

  get categoryName(): string | null {
    return this._categoryName;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get weight(): number {
    return this._weight;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get length(): number {
    return this._length;
  }
}
