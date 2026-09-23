# Frontend Phase F5 — Bills, airtime & receive

## Done

- [x] Pay modal: Bills / Airtime tabs, NG catalog, PIN gate, debit NGN
- [x] Receive modal: create USD/EUR virtual accounts, share details, simulate inbound
- [x] Home quick actions: Add · Convert · Pay · Receive
- [x] Profile money tools: bills, receive, cards

## Wire-up

| Screen | API |
|---|---|
| Bills catalog | `GET /v1/bills/catalog?country=NG` |
| Pay bill | `POST /v1/bills/pay` |
| Airtime operators | `GET /v1/airtime/operators?country=NG` |
| Airtime top-up | `POST /v1/airtime/topup` |
| Virtual accounts | `GET/POST /v1/accounts/virtual` |
| Sandbox inbound | `POST /v1/accounts/virtual/:id/simulate-inbound` |

Bill/airtime spend **NGN**. Receive credits the matching **USD** or **EUR** wallet.

## Try

1. Fund NGN → Home → **Pay** → DStv → customer ref → amount → PIN
2. Home → **Pay** → Airtime → MTN → `+234…` → amount → PIN
3. Home → **Receive** → Create USD account → open → Share details
4. Simulate inbound $250 → Home USD balance rises · Activity shows `receive`
