export class ListCouponsQuery {
  constructor(
    public readonly resellerId?: string | null,
    public readonly isActive?: boolean,
  ) {}
}
