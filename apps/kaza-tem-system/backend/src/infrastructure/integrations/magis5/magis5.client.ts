import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import {
  Magis5ClientPort,
  Magis5ProductImage,
  Magis5UploadImageRequest,
} from './magis5-client.port';

@Injectable()
export class Magis5Client implements Magis5ClientPort {
  private readonly logger = new Logger(Magis5Client.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('MAGIS5_API_URL') || 'https://api.magis5.com';
    this.apiKey = this.configService.get<string>('MAGIS5_API_KEY') || '';

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
    });
  }

  async getProductImages(productId: string): Promise<Magis5ProductImage[]> {
    if (!this.apiKey) {
      this.logger.warn('Magis5 API key not configured, returning mock images');
      return this.getMockImages(productId);
    }

    try {
      const response = await this.httpClient.get<{ images: any[] }>(
        `/products/${productId}/images`,
      );

      return response.data.images.map((img, index) => ({
        id: img.id || `img-${index}`,
        productId,
        url: img.url || img.full_url,
        thumbnailUrl: img.thumbnail_url || img.url,
        isPrimary: img.is_primary || index === 0,
        order: img.order || index,
        altText: img.alt_text || `Product ${productId} image ${index + 1}`,
        width: img.width,
        height: img.height,
      }));
    } catch (error) {
      this.logger.error(`Failed to get images for product ${productId}`, error);
      return this.getMockImages(productId);
    }
  }

  async uploadProductImage(request: Magis5UploadImageRequest): Promise<Magis5ProductImage> {
    if (!this.apiKey) {
      this.logger.warn('Magis5 API key not configured, returning mock upload result');
      return this.getMockUploadResult(request);
    }

    try {
      const formData = new FormData();
      formData.append('image', request.imageBuffer, request.fileName);
      formData.append('is_primary', request.isPrimary ? 'true' : 'false');
      if (request.altText) {
        formData.append('alt_text', request.altText);
      }

      const response = await this.httpClient.post(
        `/products/${request.productId}/images`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      const img = response.data;

      this.logger.log(`Uploaded image for product ${request.productId}: ${img.id}`);

      return {
        id: img.id,
        productId: request.productId,
        url: img.url,
        thumbnailUrl: img.thumbnail_url || img.url,
        isPrimary: img.is_primary || false,
        order: img.order || 0,
        altText: img.alt_text,
        width: img.width,
        height: img.height,
      };
    } catch (error) {
      this.logger.error(`Failed to upload image for product ${request.productId}`, error);
      throw new Error('Failed to upload product image');
    }
  }

  async deleteProductImage(imageId: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('Magis5 API key not configured, simulating delete');
      return true;
    }

    try {
      await this.httpClient.delete(`/images/${imageId}`);
      this.logger.log(`Deleted image: ${imageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete image ${imageId}`, error);
      return false;
    }
  }

  async setPrimaryImage(imageId: string, productId: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('Magis5 API key not configured, simulating set primary');
      return true;
    }

    try {
      await this.httpClient.patch(`/products/${productId}/images/${imageId}/primary`);
      this.logger.log(`Set image ${imageId} as primary for product ${productId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set primary image ${imageId}`, error);
      return false;
    }
  }

  private getMockImages(productId: string): Magis5ProductImage[] {
    return [
      {
        id: `img-${productId}-1`,
        productId,
        url: `https://via.placeholder.com/800x800.png?text=Product+${productId}`,
        thumbnailUrl: `https://via.placeholder.com/200x200.png?text=Product+${productId}`,
        isPrimary: true,
        order: 0,
        altText: `Product ${productId} main image`,
        width: 800,
        height: 800,
      },
      {
        id: `img-${productId}-2`,
        productId,
        url: `https://via.placeholder.com/800x800.png?text=Product+${productId}+Detail`,
        thumbnailUrl: `https://via.placeholder.com/200x200.png?text=Product+${productId}+Detail`,
        isPrimary: false,
        order: 1,
        altText: `Product ${productId} detail image`,
        width: 800,
        height: 800,
      },
    ];
  }

  private getMockUploadResult(request: Magis5UploadImageRequest): Magis5ProductImage {
    return {
      id: `mock-img-${Date.now()}`,
      productId: request.productId,
      url: `https://via.placeholder.com/800x800.png?text=Uploaded+${request.fileName}`,
      thumbnailUrl: `https://via.placeholder.com/200x200.png?text=Uploaded+${request.fileName}`,
      isPrimary: request.isPrimary || false,
      order: 99,
      altText: request.altText || request.fileName,
      width: 800,
      height: 800,
    };
  }
}
