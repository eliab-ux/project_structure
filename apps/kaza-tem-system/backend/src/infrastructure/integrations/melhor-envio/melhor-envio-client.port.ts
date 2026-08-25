export const MELHOR_ENVIO_CLIENT = Symbol('MELHOR_ENVIO_CLIENT');

export interface MelhorEnvioAddress {
  postal_code: string;
  city?: string;
  state?: string;
}

export interface MelhorEnvioPackage {
  weight: number;
  width: number;
  height: number;
  length: number;
}

export interface MelhorEnvioShippingQuote {
  id: number;
  name: string;
  company: {
    id: number;
    name: string;
    picture: string;
  };
  price: string;
  custom_price: string;
  discount: string;
  currency: string;
  delivery_time: number;
  delivery_range: {
    min: number;
    max: number;
  };
}

export interface MelhorEnvioTrackingEvent {
  status: string;
  description: string;
  datetime: string;
  location?: string;
}

export interface MelhorEnvioTracking {
  id: string;
  protocol: string;
  status: string;
  tracking: string;
  events: MelhorEnvioTrackingEvent[];
}

export interface MelhorEnvioClientPort {
  calculateShipping(
    from: MelhorEnvioAddress,
    to: MelhorEnvioAddress,
    packages: MelhorEnvioPackage[],
  ): Promise<MelhorEnvioShippingQuote[]>;

  trackShipment(trackingCode: string): Promise<MelhorEnvioTracking>;
}
