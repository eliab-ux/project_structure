export const VIDEO_GATEWAY = Symbol('VIDEO_GATEWAY');

export interface VideoRoom {
  name: string;
  url: string;
}

/**
 * Outbound port for the video provider (Daily.co). The application never talks to the
 * provider directly — only through this contract. Adapter concreto vive em infra (Fase 6).
 */
export interface VideoGatewayPort {
  createRoom(): Promise<VideoRoom>;
  deleteRoom(name: string): Promise<void>;
}
