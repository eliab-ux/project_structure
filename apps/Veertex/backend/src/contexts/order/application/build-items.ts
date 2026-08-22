import { OrderItem } from '../domain/entities/order-item.entity';
import { OrderProductLookupPort } from './ports/output/order-product-lookup.port';
import { OrderProductInvalidException } from '../domain/exceptions/order-exceptions';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  /** Preço unitário. Ausente → usa o preço base do produto (§3.5). */
  unitPrice?: number | null;
  discountPercent?: number | null;
  discountValue?: number | null;
  /** Descrição opcional; ausente → snapshot do nome do produto. */
  description?: string | null;
}

/**
 * Valida os produtos e monta os itens de domínio, num só lugar (criação e edição chamam o mesmo).
 *
 * Cada produto precisa existir, estar ativo e ser da conta (o lookup é escopado; id de outra conta
 * simplesmente não vem → "produto não encontrado", sem revelar existência alheia). O nome é
 * fotografado no item (o pedido não muda se o produto for renomeado depois); o preço cai para o base
 * quando não vem explícito, e um produto sem preço base exige preço no item.
 */
export async function buildOrderItems(
  lookup: OrderProductLookupPort,
  inputs: readonly OrderItemInput[],
): Promise<OrderItem[]> {
  if (inputs.length === 0) {
    return [];
  }

  const found = await lookup.findByIds(inputs.map((input) => input.productId));

  return inputs.map((input) => {
    const product = found.get(input.productId);
    if (!product || !product.active) {
      throw new OrderProductInvalidException('Produto não encontrado ou inativo.');
    }
    if (input.quantity <= 0) {
      throw new OrderProductInvalidException(`Quantidade inválida para "${product.name}".`);
    }
    const unitPrice = input.unitPrice ?? product.basePrice;
    if (unitPrice === null || unitPrice === undefined) {
      throw new OrderProductInvalidException(
        `"${product.name}" não tem preço base — informe o preço no item.`,
      );
    }
    return OrderItem.create({
      productId: product.id,
      description: input.description?.trim() || product.name,
      quantity: input.quantity,
      unitPrice,
      discountPercent: input.discountPercent,
      discountValue: input.discountValue,
    });
  });
}
