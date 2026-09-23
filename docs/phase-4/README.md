# Phase 4 — Business, Stablecoins, Physical Cards, Public API

## Scope

- Organizations with roles (`owner` / `admin` / `approver` / `member`)
- Org NGN wallet + approval-limited bulk payouts
- USDC / USDT deposit + 1:1 convert ↔ USD (sandbox custody)
- Physical card issuance + shipping fields
- Developer API keys (`np_test_…`) + webhook endpoints
- Public read APIs: `/v1/public/wallets`, `/v1/public/transactions`

## Apply schema

```bash
cd apps/api && npm run db:push
# restart start:dev
```

## Quick flows

```bash
# Business
curl -s localhost:3000/v1/business/organizations -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Imports","slug":"ada-imports","approvalLimitMajor":50000}'

curl -s localhost:3000/v1/business/organizations/$ORG_ID/wallet/fund \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amountMajor":200000,"idempotencyKey":"org-fund-1"}'

# Stablecoins
curl -s localhost:3000/v1/stablecoins/deposit -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"currency":"USDC","amountMajor":100,"idempotencyKey":"usdc-1"}'

curl -s localhost:3000/v1/stablecoins/convert -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"sourceCurrency":"USDC","destCurrency":"USD","sourceAmountMajor":50,"idempotencyKey":"conv-1"}'

# Physical card
curl -s localhost:3000/v1/cards -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"form":"physical","label":"Travel","shippingName":"Ada","shippingLine1":"12 Broad St","shippingCity":"Lagos","shippingCountry":"NG","shippingPostal":"100001"}'

# API key
curl -s localhost:3000/v1/developer/api-keys -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"backend","scopes":["wallets:read","transactions:read"]}'
# use returned apiKey as Bearer for:
curl -s localhost:3000/v1/public/wallets -H "authorization: Bearer $API_KEY"
```
