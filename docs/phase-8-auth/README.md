# Auth hardening (production)

Production-oriented authentication: hashed OTPs, attempt lockout, refresh rotation/revocation, SMS providers, step-up for large payouts, hashed app PIN.

## What changed

| Area | Behavior |
|------|----------|
| OTP at rest | SHA-256(`pepper:phone:code`) in Redis — plaintext never stored |
| OTP attempts | Lock phone after `OTP_MAX_ATTEMPTS` failures for `OTP_LOCKOUT_SECONDS` |
| SMS delivery | `SMS_OTP_MODE=log\|http\|twilio` — **log forbidden in production** |
| Dev fixed OTP | Only non-production; must be empty in production |
| Refresh tokens | JWT `jti` registered in Redis; refresh **rotates**; logout **revokes** |
| KYC auto-approve | Disabled in production/staging |
| Step-up | Payouts ≥ `AUTH_STEPUP_PAYOUT_MINOR` need recent `/v1/auth/step-up` |
| Mobile PIN | Salted SHA-256 in SecureStore (migrates old plaintext once) |

## Production env (required)

```env
NODE_ENV=production
OTP_DEV_FIXED_CODE=
OTP_PEPPER=<random-32+-char-secret>
SMS_OTP_MODE=twilio   # or http
# Twilio:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
# or HTTP gateway:
# SMS_OTP_MODE=http
# SMS_HTTP_URL=https://your-sms-gateway/send
# SMS_HTTP_API_KEY=

JWT_ACCESS_SECRET=<rotate from dev>
JWT_REFRESH_SECRET=<rotate from dev>
AUTH_STEPUP_PAYOUT_MINOR=50000000
KYC_AUTO_APPROVE=false
SWAGGER_ENABLED=false
```

## Local / sandbox

```env
SMS_OTP_MODE=log
OTP_DEV_FIXED_CODE=000000
OTP_PEPPER=novapay-dev-otp-pepper-change-me
```

## Step-up API

```http
POST /v1/auth/step-up/request
Authorization: Bearer <access>

POST /v1/auth/step-up/verify
{ "code": "123456" }
```

Then payout above threshold succeeds within `AUTH_STEPUP_TTL_SECONDS`.

## Logout

```http
POST /v1/auth/logout
{ "refreshToken": "..." }

POST /v1/auth/logout/all
Authorization: Bearer <access>
```
