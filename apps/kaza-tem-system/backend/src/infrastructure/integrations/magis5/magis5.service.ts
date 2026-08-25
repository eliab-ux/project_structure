import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MAGIS5_CLIENT,
  Magis5ClientPort,
  Magis5ProductImage,
  Magis5UploadImageRequest,
} from './magis5-client.port';

@Injectable()
export class Magis5Service {
  private readonly logger = new Logger(Magis5Service.name);

  constructor(
    @Inject(MAGIS5_CLIENT)
    private readonly client: Magis5ClientPort,
  ) {}

  async getProductImages(productId: string): Promise<Magis5ProductImage[]> {
    try {
      return await this.client.getProductImages(productId);
    } catch (error) {
      this.logger.error(`Failed to get product images for ${productId}`, error);
      throw new Error('Failed to get product images');
    }
  }

  async uploadProductImage(
    productId: string,
    imageBuffer: Buffer,
    fileName: string,
    options?: { isPrimary?: boolean; altText?: string },
  ): Promise<Magis5ProductImage> {
    try {
      const request: Magis5UploadImageRequest = {
        productId,
        imageBuffer,
        fileName,
        isPrimary: options?.isPrimary,
        altText: options?.altText,
      };

      return await this.client.uploadProductImage(request);
    } catch (error) {
      this.logger.error(`Failed to upload image for product ${productId}`, error);
      throw new Error('Failed to upload product image');
    }
  }

  async deleteProductImage(imageId: string): Promise<boolean> {
    try {
      return await this.client.deleteProductImage(imageId);
    } catch (error) {
      this.logger.error(`Failed to delete image ${imageId}`, error);
      throw new Error('Failed to delete product image');
    }
  }

  async setPrimaryImage(imageId: string, productId: string): Promise<boolean> {
    try {
      return await this.client.setPrimaryImage(imageId, productId);
    } catch (error) {
      this.logger.error(`Failed to set primary image ${imageId}`, error);
      throw new Error('Failed to set primary image');
    }
  }

  async syncProductImages(
    productId: string,
    externalProductId?: string,
  ): Promise<Magis5ProductImage[]> {
    this.logger.log(`Syncing images for product ${productId}`);

    try {
      // Get current images
      const images = await this.getProductImages(externalProductId || productId);

      this.logger.log(`Synced ${images.length} images for product ${productId}`);

      return images;
    } catch (error) {
      this.logger.error(`Failed to sync images for product ${productId}`, error);
      return [];
    }
  }
}
