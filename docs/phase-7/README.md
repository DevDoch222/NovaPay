# Phase 7 — Compliance & Risk

KYC tier limits (daily/monthly), sanctions screening, AML alerts, velocity controls, card disputes, and NDPR retention stubs.

## Scope

| Area | Deliverable | Status |
|------|-------------|--------|
| Limits | Daily/monthly fund + payout + wallet balance via `checkLimits` | Done |
| Sanctions | `mock` \| `http` \| `off` provider on payout + inbound | Done |
| AML | `compliance_alerts` table + large-amount monitoring | Done |
| Velocity | Redis OTP / payout / card auth windows | Done |
| Disputes | Open + admin resolve (won → ledger reversal) | Done |
| Retention | NDPR purge stub for `status=closed` users | Done |
| APIs | `/v1/compliance/*` and `/v1/admin/compliance/*` | Done |

## KYC tier limits

| Tier | Single payout | Daily payout | Monthly payout | Wallet max |
|------|---------------|--------------|----------------|------------|
| tier_0 | 0 | 0 | 0 | ₦50,000 |
| tier_1 | ₦200,000 | ₦500,000 | ₦2,000,000 | ₦2,000,000 |
| tier_2 | ₦5,000,000 | ₦10,000,000 | ₦50,000,000 | ₦50,000,000 |

Fund caps are also enforced (single / daily / monthly). Limits use pending + processing + completed transactions in UTC windows.

```http
GET /v1/compliance/limits?currency=NGN
```

## Sanctions

| Env | Default |
|-----|---------|
| `SANCTIONS_MODE` | `mock` |
| `SANCTIONS_API_URL` | (empty) |
| `SANCTIONS_API_KEY` | (empty) |

Mock blocks high-risk countries (`KP`, `IR`, `SY`, `CU`) and a small demo blacklist. HTTP mode POSTs `{ name, country }` and expects `{ score, cleared?, matchDetails? }`; failures fall back to mock.

## AML alerts

Large transfers (≥ `AML_LARGE_AMOUNT_MINOR`, default ₦1,000,000) create open alerts. Sanctions hits create critical alerts.

```http
GET /v1/admin/compliance/alerts?status=open
PATCH /v1/admin/compliance/alerts/:id
{ "status": "dismissed" }
```

## Velocity

| Env | Default | Meaning |
|-----|---------|---------|
| `AML_VELOCITY_OTP_LIMIT` / `WINDOW` | 5 / 600s | OTP requests per phone |
| `AML_VELOCITY_PAYOUT_LIMIT` / `WINDOW` | 10 / 3600s | Payouts per user |
| `AML_VELOCITY_CARD_LIMIT` / `WINDOW` | 20 / 3600s | Card auths per user |

## Card disputes

```http
POST /v1/compliance/disputes
{ "cardId", "transactionId", "reason" }

GET /v1/compliance/disputes

POST /v1/admin/compliance/disputes/:id/resolve
{ "outcome": "won" | "lost", "resolutionNote": "..." }
```

Won disputes post a `reversal` ledger entry (system card holds/settlement → user USD wallet) and mark the original spend `reversed`.

## NDPR retention stub

```http
POST /v1/admin/compliance/retention/purge
{ "userId": "..." }
```

Requires `users.status = closed`. Redacts phone / email / tag / avatar; ledger history is retained.

## Schema

Run after pull:

```bash
cd apps/api && npx drizzle-kit push --force
```

Adds `compliance_alerts` and `card_disputes`.

## Exit criteria

- [x] Expanded KYC limits enforced on fund + payout
- [x] Sanctions provider wired to payout + inbound
- [x] AML alert persistence + admin APIs
- [x] OTP / payout / card velocity
- [x] Card disputes + reversal
- [x] NDPR purge stub
- [x] Health `phase: 7`
- [x] Unit tests for limits + mock sanctions

## Next

**Phase 8** — Infrastructure hardening (secrets, observability, backups, staging).
