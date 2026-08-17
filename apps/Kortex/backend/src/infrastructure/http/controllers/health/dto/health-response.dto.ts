export class HealthResponseDto {
  status!: 'ok';
  app!: string;
  timestamp!: string;

  static ok(app: string): HealthResponseDto {
    const dto = new HealthResponseDto();
    dto.status = 'ok';
    dto.app = app;
    dto.timestamp = new Date().toISOString();
    // Nada de versão, contagem, nome de banco ou configuração: liveness não é lugar de
    // reconhecimento de infraestrutura.
    return dto;
  }
}
