# Phase 2 — FX + Virtual USD Card

## Scope

- Transparent FX quotes (mid + margin) with 60s lock
- Convert NGN ↔ USD via double-entry (per-currency balanced)
- USD wallet on signup
- Virtual USD card (mock issuer): issue, freeze, authorize hold, settle
- PAN never stored

## Config

```env
FX_USD_NGN_MID=1600
FX_MARGIN_BPS=150
FX_QUOTE_TTL_SECONDS=60
CARD_ISSUER=mock
```

## API

```bash
# Rate
curl -s 'localhost:3000/v1/fx/rate?source=NGN&dest=USD'

# Quote + book (needs NGN balance)
curl -s localhost:3000/v1/fx/quotes -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"sourceCurrency":"NGN","destCurrency":"USD","sourceAmountMajor":160000}'

curl -s localhost:3000/v1/fx/quotes/$QUOTE_ID/book -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"fx-demo-1"}'

# Virtual card
curl -s localhost:3000/v1/cards -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"label":"SaaS","spendLimitMajor":50}'

curl -s localhost:3000/v1/cards/$CARD_ID/authorize -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"amountMajor":10,"merchant":"Notion","idempotencyKey":"auth-1"}'

curl -s -X POST localhost:3000/v1/cards/authorizations/$AUTH_ID/settle \
  -H "authorization: Bearer $TOKEN"
```

## Apply schema

```bash
cd apps/api && npm run db:push
```

If Postgres rejects new enum values, run:

```sql
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'convert';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'card_spend';
```

## Note

Real card BIN sponsorship (Marqeta / Union54 / etc.) replaces `MockCardIssuer` later.
