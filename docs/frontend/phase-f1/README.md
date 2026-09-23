# Frontend Phase F1 — Onboarding & auth

## Done

- [x] Welcome carousel → phone (E.164) → OTP → PIN (+ optional biometrics)
- [x] Session in SecureStore (web: localStorage fallback)
- [x] JWT access/refresh + `/v1/auth/me` hydrate
- [x] KYC step flow → `POST /v1/auth/kyc` (sandbox auto-approve → `tier_1`)
- [x] PIN unlock gate on cold start
- [x] Auth redirects + protected tabs
- [x] Profile shows live user / tier / sign out
- [x] Home empty wallets (live session; balances still F2)

## Wire-up

| Screen | API |
|---|---|
| Phone | `POST /v1/auth/otp/request` |
| OTP | `POST /v1/auth/otp/verify` |
| Session restore | `POST /v1/auth/token/refresh`, `GET /v1/auth/me` |
| KYC | `POST /v1/auth/kyc` |

## Run

```bash
# API (Redis required for OTP)
docker compose up -d redis
cd apps/api && npm run start:dev

# Mobile
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

Sandbox OTP: set `OTP_DEV_FIXED_CODE=000000` in `apps/api/.env`. The app surfaces `devCode` when the API returns it.

Physical device: set `EXPO_PUBLIC_API_URL` to your machine LAN IP (`http://192.168.x.x:3000`). Expo Go host autodetection is used when unset.

## Exit criteria

User can sign up with phone OTP, set a PIN, submit KYC (or skip), and land on Home with empty wallet/activity states.
