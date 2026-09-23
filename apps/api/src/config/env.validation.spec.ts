/**
 * Phase 0 config sanity check — keeps CI green without wiring infra.
 */
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    NODE_ENV: 'test',
    PORT: '3000',
    APP_NAME: 'novapay-api',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    DATABASE_URL_DIRECT: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test-access-secret-min-32-characters!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-characters!',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    LOG_LEVEL: 'error',
  };

  it('accepts a valid configuration', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.APP_NAME).toBe('novapay-api');
  });

  it('rejects short JWT secrets', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects log SMS mode in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        SMS_OTP_MODE: 'log',
        OTP_DEV_FIXED_CODE: '',
        OTP_PEPPER: 'production-otp-pepper-min-16',
      }),
    ).toThrow(/SMS_OTP_MODE=log/);
  });
});
