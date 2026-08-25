import { HealthController } from '../../../../src/infrastructure/http/controllers/health/health.controller';

describe('HealthController', () => {
  it('reports liveness and nothing else', () => {
    const body = new HealthController().check();

    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    // A public probe must not expose configuration or tenant data.
    expect(Object.keys(body).sort()).toEqual(['app', 'status', 'timestamp', 'uptimeSeconds']);
  });
});
