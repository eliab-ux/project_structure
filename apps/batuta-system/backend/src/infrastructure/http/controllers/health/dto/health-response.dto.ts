/**
 * Liveness payload. Deliberately minimal: an unauthenticated caller learns that the process
 * is up and nothing else — no version of dependencies, no database or queue state.
 */
export class HealthResponseDto {
  status!: 'ok';
  app!: string;
  timestamp!: string;
  uptimeSeconds!: number;

  static ok(appName: string): HealthResponseDto {
    const dto = new HealthResponseDto();
    dto.status = 'ok';
    dto.app = appName;
    dto.timestamp = new Date().toISOString();
    dto.uptimeSeconds = Math.floor(process.uptime());
    return dto;
  }
}
