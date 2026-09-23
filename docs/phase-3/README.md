# Phase 3 — Receive rails, MoMo, Bills

## Scope

- USD / EUR virtual receiving accounts (mock BaaS)
- Inbound credit via simulate endpoint or BaaS webhook
- Mobile-money beneficiaries + payouts (MTN / Airtel / M-Pesa)
- Bill pay + airtime catalogs (sandbox)
- Light AML screening stub on inbound / payout
- EUR wallet on signup

## Apply schema

```bash
cd apps/api && npm run db:push
```

If enums fail:

```sql
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'receive';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bill';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'airtime';
```

## API

```bash
# Virtual USD account (freelancer receive)
curl -s localhost:3000/v1/accounts/virtual -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"currency":"USD"}'

curl -s localhost:3000/v1/accounts/virtual/$VA_ID/simulate-inbound \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amountMajor":250,"currency":"USD","externalReference":"ach-demo-1","senderName":"Acme Inc"}'

# MoMo beneficiary + payout
curl -s localhost:3000/v1/beneficiaries -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"type":"mobile_money","country":"NG","provider":"mtn","accountName":"Chioma","accountNumber":"08012345678"}'

curl -s localhost:3000/v1/payments/payout -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"beneficiaryId":"$BEN_ID","amountMajor":500,"idempotencyKey":"momo-1"}'

# Bills / airtime
curl -s 'localhost:3000/v1/bills/catalog?country=NG'
curl -s localhost:3000/v1/bills/pay -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"billerId":"ng-dstv","customerRef":"1234567890","amountMajor":9000,"idempotencyKey":"bill-1"}'

curl -s localhost:3000/v1/airtime/topup -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"operatorId":"ng-mtn","phone":"+2348012345678","amountMajor":500,"idempotencyKey":"air-1"}'
```

## Partners later

Replace `MockBaasProvider` with a real BaaS (USD/EUR VAs). MoMo can stay on Flutterwave/aggregator once IP whitelist + MoMo product is enabled.
