import api from 'src/services/api';
import { Fabric, ProductType } from 'src/types/customer';

async function listFabrics(): Promise<Fabric[]> {
  const response = await api.get<Fabric[]>('/fabrics');
  return response.data;
}

export interface FabricPayload {
  name: string;
  maxLayerHeightCm: number;
  /** Opcional: sem ela o sistema não avisa sobre altura, que é o certo enquanto não foi medida. */
  layerThicknessCm?: number | null;
  notes?: string | null;
}

async function createFabric(payload: FabricPayload): Promise<Fabric> {
  const response = await api.post<Fabric>('/fabrics', payload);
  return response.data;
}

async function updateFabric(id: string, payload: FabricPayload): Promise<Fabric> {
  const response = await api.put<Fabric>(`/fabrics/${id}`, payload);
  return response.data;
}

async function listProductTypes(): Promise<ProductType[]> {
  const response = await api.get<ProductType[]>('/product-types');
  return response.data;
}

async function createProductType(name: string): Promise<ProductType> {
  const response = await api.post<ProductType>('/product-types', { name });
  return response.data;
}

async function updateProductType(id: string, name: string): Promise<ProductType> {
  const response = await api.put<ProductType>(`/product-types/${id}`, { name });
  return response.data;
}

const catalogService = {
  listFabrics,
  createFabric,
  updateFabric,
  listProductTypes,
  createProductType,
  updateProductType,
};
export default catalogService;
