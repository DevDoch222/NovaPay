# Phase 5 — API Hardening & Testing

Platform hardening for production-grade API contracts: standardized errors, pagination, idempotency headers, rate limiting, OpenAPI docs, and test coverage.

## Scope

| Area | Deliverable | Status |
|------|-------------|--------|
| Errors | Global exception filter with `{ success, message, error: { code, message, details? } }` | Done |
| Pagination | `page` + `limit` query params; `{ items, pagination }` on list endpoints | Done |
| Idempotency | `Idempotency-Key` header on POST (Redis cache, 24h TTL) + existing body keys | Done |
| Rate limiting | `@nestjs/throttler` global guard; tighter limits on OTP endpoints | Done |
| OpenAPI | Swagger UI at `/docs` | Done |
| Tests | Unit tests for filter + pagination; CI runs lint + test + build | Done |

## Standard error format

All API errors return:

```json
{
  "success": false,
  "message": "Human-readable summary",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": []
  }
}
```

**Error codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `IDEMPOTENCY_IN_PROGRESS`, `DATABASE_ERROR`, `INTERNAL_ERROR`.

## Pagination

List endpoints accept:

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `limit` | 50 | 100 |

Response shape:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 120,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Paginated endpoints:** `GET /v1/transactions`, `GET /v1/beneficiaries`, `GET /v1/cards`, `GET /v1/developer/api-keys`, `GET /v1/developer/webhooks`, `GET /v1/public/transactions`, `GET /v1/business/organizations`, `GET /v1/business/organizations/:orgId/members`, `GET /v1/business/organizations/:orgId/bulk-payouts`, `GET /v1/accounts/virtual`, `GET /v1/stablecoins/balances`.

## Idempotency

- **Header:** `Idempotency-Key` (min 8 chars) on authenticated POST requests.
- **Body:** Existing `idempotencyKey` fields on fund/payout/bills/etc. remain supported.
- **TTL:** `IDEMPOTENCY_TTL_SECONDS` (default 86400).
- **Scope:** `{userId}:{method}:{path}:{key}` in Redis.
- Duplicate in-flight requests return `409` with `IDEMPOTENCY_IN_PROGRESS`.

## Rate limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Authenticated (default) | 120 | 60s |
| `POST /v1/auth/otp/request` | 10 | 60s |
| `POST /v1/auth/otp/verify` | 20 | 60s |
| `/health/*` | Skipped | — |

Configure via `THROTTLE_LIMIT`, `THROTTLE_TTL_MS`, `THROTTLE_PUBLIC_LIMIT`.

## OpenAPI

- Enable: `SWAGGER_ENABLED=true` (default).
- URL: `http://localhost:3000/docs`
- Bearer JWT auth supported in UI.

## Environment

```bash
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=120
THROTTLE_PUBLIC_LIMIT=30
IDEMPOTENCY_TTL_SECONDS=86400
SWAGGER_ENABLED=true
```

## Test strategy

| Layer | Tooling | Scope |
|-------|---------|-------|
| Unit | Jest | Filter, pagination, FX/ledger math, env validation |
| Integration | Jest + Supertest (mocked services) | Auth OTP contracts, payments pagination, error envelope |
| E2E | Jest e2e (`E2E_LIVE=true`) against running API | Full OTP → fund → list transactions |

Run locally:

```bash
cd apps/api
npm test
npm run test:e2e
# Live auth/payments smoke (API must already be running):
docker compose up -d redis   # from repo root
npm run start:dev            # terminal 1
E2E_LIVE=true npm run test:e2e -- --testPathPatterns=auth-payments   # terminal 2
npm run lint
npm run build
```

## Exit criteria

- [x] Uniform error envelope on all failures
- [x] Paginated list endpoints with metadata
- [x] Idempotency-Key header support
- [x] Global rate limiting + OTP throttles
- [x] Swagger at `/docs`
- [x] CI runs unit tests on PR
- [x] Integration tests for auth + payments contracts
- [x] Remaining list endpoints (business orgs, members, batches, receive accounts, stablecoin balances)
- [x] Optional live e2e (`E2E_LIVE=true`) for OTP → fund → transactions

## Next phase

**Phase 6 — Money, Pricing & Reconciliation:** live FX provider, fee engine, Flutterwave reconciliation.
