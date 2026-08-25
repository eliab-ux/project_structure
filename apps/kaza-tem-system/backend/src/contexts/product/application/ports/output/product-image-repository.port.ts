export const PRODUCT_IMAGE_REPOSITORY = Symbol('PRODUCT_IMAGE_REPOSITORY');

export interface ProductImagePayload {
  url: string;
  position: number;
  isPrimary: boolean;
}

export interface ProductImageRepositoryPort {
  replaceForProduct(productId: string, images: ProductImagePayload[]): Promise<void>;
}
