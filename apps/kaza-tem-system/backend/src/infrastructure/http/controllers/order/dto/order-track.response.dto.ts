export class OrderTrackResponseDto {
  id!: string;
  status!: string;
  trackingCode!: string | null;

  static from(order: {
    id: string;
    status: string;
    trackingCode?: string | null;
  }): OrderTrackResponseDto {
    const dto = new OrderTrackResponseDto();
    dto.id = order.id;
    dto.status = order.status;
    dto.trackingCode = order.trackingCode ?? null;
    return dto;
  }
}
