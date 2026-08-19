import api from 'src/services/api';
import {
  CreateProductPayload,
  Product,
  ProductCatalog,
  UpdateProductPayload,
} from 'src/types/product';

async function list(params: {
  search?: string;
  kind?: string;
  categoryPath?: string;
  includeInactive?: boolean;
}): Promise<Product[]> {
  const response = await api.get<Product[]>('/products', { params });
  return response.data;
}

async function get(id: string): Promise<Product> {
  const response = await api.get<Product>(`/products/${id}`);
  return response.data;
}

/**
 * O catálogo de campos e as listas fechadas.
 *
 * Vem do backend porque o catálogo é fixo em CÓDIGO (§3.6) e porque, quando `field_config` existir,
 * esta mesma rota devolverá o catálogo já mesclado com a configuração da conta — e a tela não muda.
 * As listas (unidades, origens) vêm daqui pelo mesmo motivo: quem as valida é o servidor.
 */
async function catalog(): Promise<ProductCatalog> {
  const response = await api.get<ProductCatalog>('/products/field-catalog');
  return response.data;
}

async function create(payload: CreateProductPayload): Promise<Product> {
  const response = await api.post<Product>('/products', payload);
  return response.data;
}

async function update(id: string, payload: UpdateProductPayload): Promise<Product> {
  const response = await api.patch<Product>(`/products/${id}`, payload);
  return response.data;
}

const productService = { list, get, catalog, create, update };

export default productService;
