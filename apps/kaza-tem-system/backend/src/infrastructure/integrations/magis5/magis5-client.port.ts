export const MAGIS5_CLIENT = Symbol('MAGIS5_CLIENT');

export interface Magis5ProductImage {
  id: string;
  productId: string;
  url: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  order: number;
  altText?: string;
  width?: number;
  height?: number;
}

export interface Magis5UploadImageRequest {
  productId: string;
  imageBuffer: Buffer;
  fileName: string;
  isPrimary?: boolean;
  altText?: string;
}

export interface Magis5ClientPort {
  getProductImages(productId: string): Promise<Magis5ProductImage[]>;
  uploadProductImage(request: Magis5UploadImageRequest): Promise<Magis5ProductImage>;
  deleteProductImage(imageId: string): Promise<boolean>;
  setPrimaryImage(imageId: string, productId: string): Promise<boolean>;
}
