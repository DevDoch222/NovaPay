# Frontend Phase F7 — Business

## Done

- [x] Profile → **Business** — create/list orgs, org wallet fund (sandbox), invite by username, bulk payouts + approve
- [x] Invite accepts `tag` / `phone` / `userId`
- [x] `GET /v1/business/organizations/:orgId/bulk-payouts` batch list

## Wire-up

| Screen | API |
|---|---|
| Business list | `GET/POST /v1/business/organizations` |
| Org wallet | `GET …/wallet`, `POST …/wallet/fund` |
| Team | `GET/POST …/members` |
| Bulk | `GET/POST …/bulk-payouts`, `POST …/approve` |

## Try

1. Profile → Business → create org → sandbox fund → invite teammate by `@tag`
2. Submit bulk payout above approval limit → second user with approver role approves
