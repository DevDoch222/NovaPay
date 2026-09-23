import request from 'supertest';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { ApiErrorCode } from './../src/common/api/error-codes';

/**
 * Live auth → wallets → fund smoke flow against a running API.
 * Requires: Redis + reachable Postgres (Supabase) + `npm run start:dev`.
 *
 *   docker compose up -d redis
 *   cd apps/api && npm run start:dev
 *   # other terminal:
 *   E2E_LIVE=true npm run test:e2e -- --testPathPatterns=auth-payments
 *
 * Skipped unless E2E_LIVE=true so CI stays green without infra.
 */
loadEnv({ path: resolve(__dirname, '../.env') });

const live = process.env.E2E_LIVE === 'true';
const describeLive = live ? describe : describe.skip;
const baseUrl =
  process.env.E2E_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3000';

describeLive('Auth + Payments live flow (e2e)', () => {
  const phone = `+23480${String(Date.now()).slice(-8)}`;

  beforeAll(async () => {
    try {
      const res = await request(baseUrl).get('/health/live').timeout(5000);
      if (res.status !== 200) {
        throw new Error(`Health returned ${res.status}`);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `API not reachable at ${baseUrl} (${detail}). ` +
          'Start Redis (`docker compose up -d redis`) and the API (`npm run start:dev`), then retry.',
      );
    }
  }, 15_000);

  it('OTP → me → wallets → fund → transactions (paginated)', async () => {
    const otpReq = await request(baseUrl)
      .post('/v1/auth/otp/request')
      .send({ phone })
      .expect(201);

    const code = (otpReq.body as { devCode?: string }).devCode ?? '000000';

    const verified = await request(baseUrl)
      .post('/v1/auth/otp/verify')
      .send({ phone, code })
      .expect(201);

    const accessToken = (verified.body as { accessToken: string }).accessToken;
    expect(accessToken).toBeTruthy();

    await request(baseUrl)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as { phone: string }).phone).toBe(phone);
      });

    await request(baseUrl)
      .get('/v1/wallets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });

    const fund = await request(baseUrl)
      .post('/v1/payments/fund')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', `e2e-fund-${Date.now()}`)
      .send({
        amountMajor: 500,
        currency: 'NGN',
        idempotencyKey: `e2e-body-${Date.now()}`,
      })
      .expect(201);

    const fundId = (fund.body as { id: string }).id;
    expect(fundId).toBeTruthy();

    await request(baseUrl)
      .post(`/v1/payments/fund/${fundId}/simulate-complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const txns = await request(baseUrl)
      .get('/v1/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = txns.body as {
      items: unknown[];
      pagination: { page: number; limit: number; total: number };
    };
    expect(list.items).toEqual(expect.any(Array));
    expect(list.pagination).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(list.pagination.total).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('returns standardized 401 without token', async () => {
    const res = await request(baseUrl).get('/v1/wallets').expect(401);

    const body = res.body as {
      success: boolean;
      error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
  });
});
