# Phase 1 — MVP Backend

## Scope

- Phone OTP auth + JWT
- KYC submit (auto-approve in sandbox → `tier_1`)
- NGN wallet + double-entry ledger
- Fund wallet (mock rail + simulate-complete)
- Bank/MoMo beneficiary + payout (mock rail)
- Transaction history

## Corridor

`NGN` only. Amounts stored in **kobo** (`amountMinor`).

## API flow (sandbox)

```bash
# 1. OTP
curl -s localhost:3000/v1/auth/otp/request -H 'content-type: application/json' \
  -d '{"phone":"+2348012345678"}'
# code is 000000 when OTP_DEV_FIXED_CODE is set

curl -s localhost:3000/v1/auth/otp/verify -H 'content-type: application/json' \
  -d '{"phone":"+2348012345678","code":"000000"}'
# save accessToken

# 2. KYC (raises payout limits)
curl -s localhost:3000/v1/auth/kyc -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"documentType":"NIN","documentNumber":"12345678901","fullName":"Ada Lovelace"}'

# 3. Fund
curl -s localhost:3000/v1/payments/fund -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"amountMajor":5000,"idempotencyKey":"fund-demo-1"}'

curl -s -X POST localhost:3000/v1/payments/fund/$FUND_ID/simulate-complete \
  -H "authorization: Bearer $TOKEN"

# 4. Beneficiary + payout
curl -s localhost:3000/v1/beneficiaries -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"type":"bank","accountName":"Chioma Okafor","accountNumber":"0123456789","bankCode":"058","bankName":"GTBank"}'

curl -s localhost:3000/v1/payments/payout -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"beneficiaryId":"$BEN_ID","amountMajor":1000,"idempotencyKey":"payout-demo-1"}'

# 5. Wallets / history
curl -s localhost:3000/v1/wallets -H "authorization: Bearer $TOKEN"
curl -s localhost:3000/v1/transactions -H "authorization: Bearer $TOKEN"
```

## Apply schema

```bash
cd apps/api && npm run db:push
```

## Notes

- Real MoMo/bank rails replace `MockPaymentRailProvider` later.
- `tier_0` cannot payout (`maxSinglePayoutMinor = 0`); complete KYC first.
