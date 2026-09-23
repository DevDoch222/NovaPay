# NovaPay Mobile (Expo)

Phases **F0–F3** — shell, auth, wallets/fund/activity, convert + send.

## Stack

- Expo SDK 54 (Expo Go on device must match)
- Expo Router (auth + tabs + modals)
- Plus Jakarta Sans (display) + DM Sans (body / money)
- SecureStore session + optional biometrics

## Run

```bash
cd apps/api && npm run start:dev

cd apps/mobile
# Physical device: use your LAN IP, not localhost
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start --offline
```

## Structure

```
app/(auth)/           onboarding / OTP / PIN / KYC
app/(tabs)/           Home · Cards · Send · Activity · Profile
app/fund.tsx          Add money
app/convert.tsx       FX convert
app/add-beneficiary.tsx
app/send-money.tsx
src/wallets/          balances + txns
src/lib/              API + money + FX/send clients
```

## Next

**F4** — Virtual cards (issue, freeze, auth hold).
