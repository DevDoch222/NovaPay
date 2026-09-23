import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production', 'staging'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('novapay-api'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (Supabase pooler URL)'),
  DATABASE_URL_DIRECT: z
    .string()
    .min(
      1,
      'DATABASE_URL_DIRECT is required (Supabase direct URL for migrations)',
    ),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  KYC_PROVIDER: z.string().optional().default(''),
  CARD_ISSUER: z.string().optional().default('mock'),
  BAAS_PROVIDER: z.string().optional().default('mock-baas'),
  MOMO_AGGREGATOR: z.string().optional().default(''),
  /** Legacy partner stub — prefer FX_RATE_MODE */
  FX_RATE_PROVIDER: z.string().optional().default(''),
  /** Legacy alias — prefer SANCTIONS_MODE */
  SANCTIONS_PROVIDER: z.string().optional().default(''),
  /** Phase 7 — sanctions screening */
  SANCTIONS_MODE: z.enum(['mock', 'http', 'off']).optional().default('mock'),
  SANCTIONS_API_URL: z.string().optional().default(''),
  SANCTIONS_API_KEY: z.string().optional().default(''),
  AML_LARGE_AMOUNT_MINOR: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(1_000_000_00),
  AML_VELOCITY_OTP_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(5),
  AML_VELOCITY_OTP_WINDOW: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(600),
  AML_VELOCITY_PAYOUT_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(10),
  AML_VELOCITY_PAYOUT_WINDOW: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(3600),
  AML_VELOCITY_CARD_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(20),
  AML_VELOCITY_CARD_WINDOW: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(3600),

  /** Comma-separated phones elevated to platform admin on boot */
  ADMIN_SEED_PHONES: z.string().optional().default('+2348000000001'),

  /** Auth hardening */
  OTP_PEPPER: z
    .string()
    .min(16)
    .optional()
    .default('novapay-dev-otp-pepper-change-me'),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().optional().default(5),
  OTP_LOCKOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(900),
  SMS_OTP_MODE: z
    .enum(['log', 'http', 'twilio', 'infobip'])
    .optional()
    .default('log'),
  SMS_HTTP_URL: z.string().optional().default(''),
  SMS_HTTP_API_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
  /** Infobip — GET from portal: Base URL + API key + approved sender */
  INFOBIP_BASE_URL: z.string().optional().default('https://api.infobip.com'),
  INFOBIP_API_KEY: z.string().optional().default(''),
  INFOBIP_SENDER: z.string().optional().default('NovaPay'),
  /** Require recent step-up OTP for payouts at/above this minor amount (0 = off) */
  AUTH_STEPUP_PAYOUT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(500_000_00),
  AUTH_STEPUP_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(600),

  /** Dev/sandbox helpers — leave empty when using Infobip/Twilio */
  OTP_DEV_FIXED_CODE: z.string().optional().default(''),
  KYC_AUTO_APPROVE: z.string().optional().default('true'),

  /** Payment rail: mock | flutterwave (auto flutterwave when secret key set) */
  PAYMENT_RAIL: z.enum(['mock', 'flutterwave', 'auto']).default('auto'),
  FLW_PUBLIC_KEY: z.string().optional().default(''),
  FLW_SECRET_KEY: z.string().optional().default(''),
  FLW_ENCRYPTION_KEY: z.string().optional().default(''),
  FLW_WEBHOOK_HASH: z.string().optional().default(''),
  FLW_BASE_URL: z
    .string()
    .url()
    .optional()
    .default('https://api.flutterwave.com/v3'),

  /** Phase 2 FX — mids are quote units per 1 USD (static fallback) */
  FX_USD_NGN_MID: z.coerce.number().positive().optional().default(1600),
  FX_USD_EUR_MID: z.coerce.number().positive().optional().default(0.92),
  FX_MARGIN_BPS: z.coerce.number().int().nonnegative().optional().default(150),
  FX_QUOTE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(60),

  /** Phase 6 — live FX */
  FX_RATE_MODE: z.enum(['static', 'http', 'auto']).optional().default('static'),
  FX_HTTP_URL: z
    .string()
    .optional()
    .default('https://api.frankfurter.app/latest?from=USD&to=NGN,EUR'),
  FX_RATE_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(300),

  /** Phase 6 — fee schedule (bps + flat minor units) */
  FEE_FUND_BPS: z.coerce.number().int().nonnegative().optional().default(50),
  FEE_FUND_FLAT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  FEE_PAYOUT_BPS: z.coerce.number().int().nonnegative().optional().default(100),
  FEE_PAYOUT_FLAT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(5000),
  FEE_CARD_SPEND_BPS: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  FEE_CARD_SPEND_FLAT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  FEE_CARD_ISSUE_FLAT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  FEE_BILL_BPS: z.coerce.number().int().nonnegative().optional().default(0),
  FEE_BILL_FLAT_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  FEE_MIN_MINOR: z.coerce.number().int().nonnegative().optional().default(0),
  FEE_MAX_MINOR: z.coerce.number().int().nonnegative().optional().default(0),

  /** Phase 5 — API hardening */
  THROTTLE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().optional().default(120),
  THROTTLE_PUBLIC_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(30),
  IDEMPOTENCY_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(86_400),
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional().default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.SMS_OTP_MODE === 'log') {
      throw new Error(
        'Invalid environment configuration: SMS_OTP_MODE=log is not allowed in production (use http or twilio)',
      );
    }
    if (env.OTP_DEV_FIXED_CODE) {
      throw new Error(
        'Invalid environment configuration: OTP_DEV_FIXED_CODE must be empty in production',
      );
    }
    if (env.OTP_PEPPER === 'novapay-dev-otp-pepper-change-me') {
      throw new Error(
        'Invalid environment configuration: OTP_PEPPER must be changed from the default in production',
      );
    }
    if (env.SMS_OTP_MODE === 'http' && !env.SMS_HTTP_URL) {
      throw new Error(
        'Invalid environment configuration: SMS_HTTP_URL required when SMS_OTP_MODE=http',
      );
    }
    if (
      env.SMS_OTP_MODE === 'twilio' &&
      (!env.TWILIO_ACCOUNT_SID ||
        !env.TWILIO_AUTH_TOKEN ||
        !env.TWILIO_FROM_NUMBER)
    ) {
      throw new Error(
        'Invalid environment configuration: Twilio credentials required when SMS_OTP_MODE=twilio',
      );
    }
    if (
      env.SMS_OTP_MODE === 'infobip' &&
      (!env.INFOBIP_API_KEY || !env.INFOBIP_BASE_URL || !env.INFOBIP_SENDER)
    ) {
      throw new Error(
        'Invalid environment configuration: INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER required when SMS_OTP_MODE=infobip',
      );
    }
  }
  return env;
}
