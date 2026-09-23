# Phase 0 — Exit criteria

Phase 0 is complete when **both** engineering foundations and regulatory/partner gates are satisfied.

## Engineering (this repo)

- [x] NestJS API scaffold (`apps/api`)
- [x] Config validation (Zod) + `.env.example`
- [x] Supabase Postgres wiring (Drizzle)
- [x] Redis wiring
- [x] Health endpoints
- [x] Structured logging (Pino)
- [x] Module stubs for core domains
- [x] Docker Compose (Redis + optional local Postgres)
- [x] GitHub Actions CI (lint / test / build)
- [ ] Supabase project created (dev + staging)
- [ ] Secrets stored outside git (local `.env` + future Secrets Manager)

## Regulatory & licensing (counsel + founders)

Tracked in [REGULATORY.md](./REGULATORY.md).

- [ ] Target launch market(s) confirmed
- [ ] EMI / PSP / bank-partnership path chosen per market
- [ ] Counsel engaged; timeline for license or sponsor bank agreed

## Partners (selection, not full integration)

Tracked in [PARTNERS.md](./PARTNERS.md).

- [ ] KYC / identity provider shortlisted
- [ ] BaaS / banking partner shortlisted
- [ ] Mobile-money aggregator shortlisted
- [ ] Card issuer shortlisted (can wait until late Phase 1 / Phase 2)
- [ ] FX rate feed shortlisted
- [ ] Sanctions / PEP screening shortlisted

## Do not start Phase 1 money movement until

1. At least one licensed rail path exists for the MVP corridor (own license or partner).
2. Supabase + Redis environments exist for `development` and `staging`.
3. KYC provider decision is made (sandbox credentials available).
