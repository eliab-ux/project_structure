import api from './api';

export interface Product {
  id: string;
  blingId: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  costPrice: number;
  stock: number;
  categoryId: string | null;
  isActive: boolean;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilterParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
  sort?: string;
}

async function getAll(params?: ProductFilterParams): Promise<Product[]> {
  const response = await api.get<Product[]>('/products', {
    params,
  });
  return response.data;
}

async function getById(id: string): Promise<Product> {
  const response = await api.get<Product>(`/products/${id}`);
  return response.data;
}

const productService = { getAll, getById };

export default productService;
