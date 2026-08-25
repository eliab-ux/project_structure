import { AdminResellerDto } from '../../dto/admin-reseller.dto';

export interface ListResellersResult {
  total: number;
  items: AdminResellerDto[];
}
