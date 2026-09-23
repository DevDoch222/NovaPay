# Frontend Phase F3 — Convert & Send

## Done

- [x] Convert modal: NGN ↔ USD rate → locked quote countdown → book
- [x] Send tab: beneficiaries list, KYC gate, add recipient
- [x] Send money: amount keypad → confirm fees → payout
- [x] Home Convert quick action wired

## Wire-up

| Screen | API |
|---|---|
| Convert | `GET /v1/fx/rate`, `POST /v1/fx/quotes`, `POST /v1/fx/quotes/:id/book` |
| Beneficiaries | `GET/POST /v1/beneficiaries` |
| Payout | `POST /v1/payments/payout` |

FX corridor in this build: **NGN ↔ USD** only (matches backend mid feed).

Payouts require **KYC tier_1+** (`tier_0` single limit is ₦0). Sandbox mock rail completes instantly when configured for mock.

## Try

1. Fund NGN (F2)
2. Home → **Convert** → NGN→USD → Get locked quote → Confirm
3. Complete KYC if needed
4. Send → Add beneficiary (GTBank sandbox bank codes) → Send money
