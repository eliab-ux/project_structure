import api from 'src/services/api';
import { CatalogList } from 'src/types';

/** Catálogo inteiro com a data resolvida de cada dia — a tela de programação. */
async function days(): Promise<CatalogList> {
  const { data } = await api.get<CatalogList>('/catalog/days');
  return data;
}

const catalogService = { days };
export default catalogService;
