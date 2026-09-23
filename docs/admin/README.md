# NovaPay Ops (Admin Console)

Web console for platform staff (`admin` / `support`) to handle support, compliance, and ledger ops.

## Run locally

```bash
# API (seeded admin phone from ADMIN_SEED_PHONES)
cd apps/api && npm run start:dev

# Admin UI (proxies /v1 → :3000)
cd apps/admin && npm install && npm run dev
```

Open http://localhost:5173

**Default seeded admin:** `+2348000000001`  

OTP is delivered via your configured SMS provider (`SMS_OTP_MODE`). For manual KYC review locally, set `KYC_AUTO_APPROVE=false` in `apps/api/.env` and restart the API.

## Capabilities

| Area | What |
|------|------|
| Customers | Search, wallets, suspend/close, open tickets |
| KYC review | Approve/reject manual ID checks → unlock tier_1/tier_2 |
| Transactions | Search/filter, ledger legs |
| Support | Queue + reply thread |
| AML | Review/dismiss/confirm alerts |
| Disputes | Resolve card disputes (won reverses ledger) |
| Reconciliation | Run/load Flutterwave day report |

## Auth model

- `users.platformRole`: `customer` \| `support` \| `admin`
- All `/v1/admin/*` routes require `AdminGuard`
- Customers use `/v1/support/*` for their own tickets
- `ADMIN_SEED_PHONES` elevates listed phones on API boot

## Env

```env
ADMIN_SEED_PHONES=+2348000000001
# optional override for admin Vite app if not using proxy:
# VITE_API_URL=http://localhost:3000
```
