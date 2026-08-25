import { HealthController } from '../../src/infrastructure/http/controllers/health/health.controller';

describe('HealthController', () => {
  it('retorna status ok com timestamp ISO e uptime', () => {
    const controller = new HealthController();

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.app).toEqual(expect.any(String));
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
