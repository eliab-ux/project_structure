import { Trip } from '../../domain/entities/trip.entity';
import { TRIP_STATUS_LABEL, TripStatus } from '../../domain/entities/trip.entity';

export class TripDto {
  id!: string;
  companyId!: string;
  routeId!: string;
  salesRepId!: string;
  helperUserId!: string | null;
  status!: string;
  statusLabel!: string;
  departureAt!: Date | null;
  returnAt!: Date | null;
  initialCash!: number;
  returnCash!: number | null;
  initialKm!: number | null;
  finalKm!: number | null;
  loadLocationId!: string | null;
  createdAt!: Date;

  static fromDomain(trip: Trip): TripDto {
    const dto = new TripDto();
    dto.id = trip.id;
    dto.companyId = trip.companyId;
    dto.routeId = trip.routeId;
    dto.salesRepId = trip.salesRepId;
    dto.helperUserId = trip.helperUserId;
    dto.status = trip.status;
    dto.statusLabel = TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status;
    dto.departureAt = trip.departureAt;
    dto.returnAt = trip.returnAt;
    dto.initialCash = trip.initialCash;
    dto.returnCash = trip.returnCash;
    dto.initialKm = trip.initialKm;
    dto.finalKm = trip.finalKm;
    dto.loadLocationId = trip.loadLocationId;
    dto.createdAt = trip.createdAt;
    return dto;
  }
}
