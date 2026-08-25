import { Environment, validate } from '../../../src/config/env.validation';

const MINIMAL_ENV = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/batuta' };

describe('env.validation', () => {
  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => validate({})).toThrow(/DATABASE_URL/);
  });

  it('applies the documented defaults', () => {
    const env = validate(MINIMAL_ENV);

    expect(env.BATUTA_APP_NAME).toBe('Batuta');
    expect(env.NODE_ENV).toBe(Environment.Development);
    expect(env.PORT).toBe(3010);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.REDIS_PORT).toBe(6379);
    expect(env.APPROVAL_TOKEN_TTL_HOURS).toBe(72);
    expect(env.MINIO_BUCKET_PREFIX).toBe('batuta-');
    expect(env.FRONTEND_URL).toBe('http://localhost:3003');
  });

  it('coerces numeric variables coming as strings', () => {
    const env = validate({ ...MINIMAL_ENV, PORT: '4000', REDIS_PORT: '6380' });

    expect(env.PORT).toBe(4000);
    expect(env.REDIS_PORT).toBe(6380);
  });

  it('coerces textual booleans', () => {
    expect(validate({ ...MINIMAL_ENV, MINIO_USE_SSL: 'false' }).MINIO_USE_SSL).toBe(false);
    expect(validate({ ...MINIMAL_ENV, MINIO_USE_SSL: 'true' }).MINIO_USE_SSL).toBe(true);
    expect(validate({ ...MINIMAL_ENV, SMTP_SECURE: '1' }).SMTP_SECURE).toBe(true);
  });

  it('rejects a non-numeric PORT instead of silently falling back', () => {
    expect(() => validate({ ...MINIMAL_ENV, PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validate({ ...MINIMAL_ENV, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('never echoes the offending value in the error message', () => {
    const secretish = 'super-secret-value';
    expect(() => validate({ ...MINIMAL_ENV, PORT: secretish })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secretish) }) as Error,
    );
  });
});
