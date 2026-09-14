# NovaPay

Cross-border multi-currency digital banking platform (Africa-connected users).

## Tech stack (locked for Phase 0+)

| Layer | Choice |
|---|---|
| API | NestJS (TypeScript), modular monolith |
| DB | PostgreSQL via **Supabase** |
| Cache / locks | Redis |
| Events | SNS/SQS or Kafka (wired in Phase 1+) |
| Cloud | AWS |
| Mobile | Expo + React Native + TypeScript |

## Repo layout

```
apps/api            NestJS API
apps/mobile         Expo app (customer)
apps/admin          Web ops console (support / compliance)
docs/               Phase + admin docs
docker-compose.yml  Local Redis
```

## Quick start

```bash
# API
cp .env.example apps/api/.env   # point DATABASE_URL at Supabase
docker compose up -d redis
cd apps/api && npm install && npm run start:dev

# Mobile (F0 shell)
cd apps/mobile && npm install && npx expo start

# Admin ops console
cd apps/admin && npm install && npm run dev
# Login: +2348000000001 / OTP 000000 (after API restart with ADMIN_SEED_PHONES)
```

Health check: `GET http://localhost:3000/health`

## Backend phases

| Phase | Focus |
|---|---|
| **0–4** | Scaffold → wallets/KYC/ledger → FX/cards → receive/bills → business/public API |
| **5** | API hardening: errors, pagination, idempotency, rate limits, Swagger, tests |
| **6** | Fees, live FX mids, Flutterwave reconciliation, fee disclosure |

See `docs/phase-6/README.md` for pricing and reconciliation.

## Frontend phases

| Phase | Focus |
|---|---|
| **F0** | Design system + tab shell |
| **F1** | Onboarding / OTP auth / KYC |
| **F2** | Home, fund, activity |
| **F3** | Convert + send ← current |
| **F4+** | Cards, profile polish |

See `docs/frontend/phase-f3/README.md`.

## Supabase notes

- Use the **Transaction pooler** URL as `DATABASE_URL` (runtime, port `6543`).
- Use the **Direct** / session URL as `DATABASE_URL_DIRECT` (migrations via Drizzle, port `5432`).
- Enable SSL (`sslmode=require`) — Supabase requires it.
- We use Supabase as **Postgres hosting** only for now; auth/KYC stay in our Nest API.
# NovaPay
