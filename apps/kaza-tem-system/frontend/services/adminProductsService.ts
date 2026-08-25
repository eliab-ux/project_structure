import api from './api';

export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive';
  stock?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface SyncStatusResponse {
  status: 'active' | 'slow' | 'stopped' | 'never_used' | 'not_configured';
  lastSync: string | null;
  totalProducts: number;
}

export interface AdminProductResponse {
  data: AdminProduct[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
  };
}

export interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  stock: number;
  categoryName: string | null;
  isActive: boolean;
  images?: string[];
  primaryImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

async function list(params: ListProductsParams) {
  const response = await api.get<AdminProductResponse>('/api/admin/products', {
    params,
  });
  return response.data;
}

async function toggleActive(productId: string, isActive: boolean) {
  const response = await api.patch<{ data: AdminProduct }>(
    `/api/admin/products/${productId}/toggle-active`,
    { isActive },
  );
  return response.data.data;
}

async function getSyncStatus() {
  const response = await api.get<SyncStatusResponse>('/api/admin/marketplace/sync-status');
  return response.data;
}

const adminProductsService = {
  list,
  toggleActive,
  getSyncStatus,
};

export default adminProductsService;
