# Frontend Phase F2 — Home, fund, activity

## Done

- [x] Live wallets from `GET /v1/wallets` (NGN / USD / EUR)
- [x] Home currency toggle + pull-to-refresh
- [x] Add money modal: method → keypad → confirm → `POST /v1/payments/fund` + `simulate-complete`
- [x] Activity filters + day groups + detail bottom sheet
- [x] Recent activity on Home

## Wire-up

| Screen | API |
|---|---|
| Home / Activity | `GET /v1/wallets`, `GET /v1/transactions` |
| Add money | `POST /v1/payments/fund`, `POST /v1/payments/fund/:id/simulate-complete` |

Sandbox funds **NGN only** (integer major units). Simulate-complete credits the ledger immediately.

## Try

1. Sign in (F1)
2. Home → **Add Money** (or empty-state CTA)
3. Pick a method → enter amount → Confirm & credit
4. Balance and Activity should update (pull to refresh if needed)

Ensure the phone can reach the API LAN URL from F1 networking notes.
