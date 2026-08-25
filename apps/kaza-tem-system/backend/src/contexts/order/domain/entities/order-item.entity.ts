import { Entity } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface OrderItemProps {
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: Date;
}

export class OrderItem extends Entity<OrderItemProps> {
  private constructor(props: OrderItemProps) {
    super(props);
  }

  static create({
    orderId,
    productId,
    sku,
    name,
    quantity,
    unitPrice,
  }: {
    orderId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }): OrderItem {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    const totalPrice = Number((quantity * unitPrice).toFixed(2));

    return new OrderItem({
      id: randomUUID(),
      orderId,
      productId,
      sku,
      name,
      quantity,
      unitPrice,
      totalPrice,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  get id(): string {
    return this.props.id;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get productId(): string {
    return this.props.productId;
  }

  get sku(): string {
    return this.props.sku;
  }

  get name(): string {
    return this.props.name;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): number {
    return this.props.unitPrice;
  }

  get totalPrice(): number {
    return this.props.totalPrice;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
