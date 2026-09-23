# Frontend Phase F6 — Stablecoins

## Done

- [x] Stablecoins modal: Deposit · To USD · From USD
- [x] USDC / USDT balance strip + PIN/biometric authorization
- [x] Home currency strip shows USDC/USDT once wallets exist
- [x] Profile → Money tools → Stablecoins

## Wire-up

| Action | API |
|---|---|
| Balances | `GET /v1/stablecoins/balances` |
| Deposit (sandbox) | `POST /v1/stablecoins/deposit` `{ currency, amountMajor, idempotencyKey }` |
| Convert 1:1 | `POST /v1/stablecoins/convert` `{ sourceCurrency, destCurrency, sourceAmountMajor, idempotencyKey }` |

Pairs: **USDC ↔ USD**, **USDT ↔ USD** (sandbox rate = 1).

## Try

1. Profile → **Stablecoins** → Deposit USDC `100` → PIN
2. Home currency strip → USDC appears
3. To USD → convert `50` USDC → USD wallet rises
4. From USD → buy USDT with USD balance
5. Activity shows `stablecoin_deposit` / `stablecoin_convert`
