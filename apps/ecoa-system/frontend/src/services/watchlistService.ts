import api from 'src/services/api';
import { WatchedAccount } from 'src/types';

async function list(): Promise<WatchedAccount[]> {
  const { data } = await api.get('/watchlist');
  return data;
}

async function add(handle: string): Promise<WatchedAccount> {
  const { data } = await api.post('/watchlist', { handle });
  return data;
}

async function remove(id: string): Promise<void> {
  await api.delete(`/watchlist/${id}`);
}

const watchlistService = { list, add, remove };
export default watchlistService;
