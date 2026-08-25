export class ApplyCouponCommand {
  constructor(public readonly code: string, public readonly subtotal: number) {}
}
