import { randomUUID } from 'node:crypto';

/** Identidade do pedido. UUID gerado na aplicação, como as demais entidades do sistema. */
export class OrderId {
  private constructor(private readonly _value: string) {}

  static generate(): OrderId {
    return new OrderId(randomUUID());
  }

  static from(value: string): OrderId {
    return new OrderId(value);
  }

  get value(): string {
    return this._value;
  }
}
