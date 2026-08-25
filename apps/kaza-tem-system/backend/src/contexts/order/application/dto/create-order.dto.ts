export interface CreateOrderItemDto {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderShippingAddressDto {
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  complement?: string;
}

export class CreateOrderDto {
  userId!: string;
  resellerId?: string;
  items!: CreateOrderItemDto[];
  shippingAddress!: CreateOrderShippingAddressDto;
  shippingMethod?: string;
  shippingCost?: number;
  discount?: number;
  notes?: string;
}
