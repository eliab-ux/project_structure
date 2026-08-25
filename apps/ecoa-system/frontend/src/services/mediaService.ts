import api from 'src/services/api';
import { InsightSnapshot, Media, Paginated } from 'src/types';

async function list(params: { page?: number; limit?: number } = {}): Promise<Paginated<Media>> {
  const { data } = await api.get('/media', { params });
  return data;
}

async function insights(mediaId: string): Promise<InsightSnapshot[]> {
  const { data } = await api.get(`/media/${mediaId}/insights`);
  return data;
}

const mediaService = { list, insights };
export default mediaService;
