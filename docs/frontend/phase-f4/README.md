# Frontend Phase F4 — Virtual USD cards

## Done

- [x] Cards tab: list issued cards (last4 only), pull to refresh
- [x] Tap card → **Card details** screen (status, brand, expiry, limit, wallet)
- [x] Create virtual card modal (label + per-auth USD limit) with PIN/biometric gate
- [x] Card details actions: freeze / unfreeze / close (freeze & close gated)
- [x] Sandbox simulate purchase: authorize → settle against USD wallet
- [x] USD balance shown on Cards tab; Home Card quick action already opens this tab

## Wire-up

| Screen | API |
|---|---|
| List | `GET /v1/cards` |
| Issue | `POST /v1/cards` `{ label?, spendLimitMajor?, form: "virtual" }` |
| Freeze / unfreeze / close | `POST /v1/cards/:id/freeze\|unfreeze\|close` |
| Sandbox spend | `POST /v1/cards/:id/authorize` then `POST /v1/cards/authorizations/:authId/settle` |

PAN is never returned — issuer mock returns `last4` + expiry only (`CARD_ISSUER=mock`).

## Try

1. Fund NGN (F2) → Convert some balance to USD (F3)
2. Cards → **Create virtual card** → PIN → Done
3. Tap card → **Simulate purchase** (e.g. $10 Notion) → PIN
4. Check Home / Activity for `card_spend` and lower USD balance
5. Freeze / unfreeze; Close is permanent for that card id

Physical issue + shipping address exists on the API; mobile F4 ships **virtual** only.
