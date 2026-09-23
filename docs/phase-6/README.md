# Phase 6 — Money, Pricing & Reconciliation

Fee engine, live FX mid rates (with static fallback), Flutterwave reconciliation, and mobile fee disclosure.

## Scope

| Area | Deliverable | Status |
|------|-------------|--------|
| Fees | Configurable bps + flat fees; `GET /v1/fees/quote` | Done |
| Fees on rails | Fund credit and payout debit post fees to `fees` system wallet | Done |
| FX provider | `static` \| `http` \| `auto` with Redis cache + env mid fallback | Done |
| FX disclosure | Margin bps shown on rate/quote responses | Done |
| Reconciliation | `POST /v1/admin/reconciliation/run`, `GET .../report/:date` | Done |
| Mobile | Fund / Send / Convert show live fees or FX margin text | Done |

## Fee schedule (env)

| Env | Default | Meaning |
|-----|---------|---------|
| `FEE_FUND_BPS` | 50 | 0.50% of deposit |
| `FEE_FUND_FLAT_MINOR` | 0 | Flat kobo on fund |
| `FEE_PAYOUT_BPS` | 100 | 1.00% of payout |
| `FEE_PAYOUT_FLAT_MINOR` | 5000 | ₦50 flat |
| `FEE_CARD_SPEND_BPS` / `FLAT` | 0 | Card spend |
| `FEE_CARD_ISSUE_FLAT_MINOR` | 0 | Card issuance |
| `FEE_BILL_BPS` / `FLAT` | 0 | Bills/airtime |
| `FEE_MIN_MINOR` | 0 | Floor |
| `FEE_MAX_MINOR` | 0 | Cap (0 = none) |

### Behavior

- **Fund:** user pays `amount`; wallet credited `amount - fee`; fee → system `fees` wallet.
- **Payout:** user debited `amount + fee`; beneficiary/clearing gets `amount`; fee → `fees` wallet.

```http
GET /v1/fees/quote?type=payout&amountMajor=1000&currency=NGN
```

## FX rates

| Env | Default |
|-----|---------|
| `FX_RATE_MODE` | `static` |
| `FX_HTTP_URL` | Frankfurter USD→NGN,EUR |
| `FX_RATE_CACHE_TTL_SECONDS` | 300 |
| `FX_USD_NGN_MID` / `FX_USD_EUR_MID` | Static fallback |
| `FX_MARGIN_BPS` | 150 (disclosed to client) |

Set `FX_RATE_MODE=http` (or `auto` with URL) for live mids; failures fall back to static.

## Reconciliation

Requires JWT (same guard as other authenticated routes).

```http
POST /v1/admin/reconciliation/run
{ "date": "2026-07-15" }

GET /v1/admin/reconciliation/report/2026-07-15
```

Compares local `fund`/`payout` rows for the UTC day against Flutterwave `/transactions` when configured. Reports are cached in Redis for 7 days.

Statuses: `matched`, `amount_mismatch`, `status_mismatch`, `missing_external`, `missing_local`.

## Mobile

- Fund confirm: fee + wallet credit from `/v1/fees/quote`
- Send confirm: fee + total debit
- Convert quote: FX margin disclosure copy

## Exit criteria

- [x] Fee quotes API
- [x] Fees applied on fund credit + payout debit
- [x] FX HTTP provider + static fallback
- [x] Reconciliation run/report
- [x] Mobile fee/margin disclosure
- [x] Unit tests for fee math

## Next

**Phase 7 — Compliance & Risk:** per-tier limits engine expansion, AML monitoring, sanctions, disputes.
