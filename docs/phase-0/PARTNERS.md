# Phase 0 — Partner shortlist

Select providers in Phase 0. Integrate in Phase 1+. Prefer partners with **sandbox APIs** and African corridor coverage.

Mark one primary + one backup per category.

## Identity / KYC

| Provider | Markets | Notes | Decision |
|---|---|---|---|
| Smile Identity | Africa-wide | Doc + selfie/liveness, BVN/NIN options | ☐ Primary / ☐ Backup |
| Youverify | Nigeria-focused | Strong local ID coverage | ☐ Primary / ☐ Backup |
| Onfido | Global | Better for passport/diaspora | ☐ Primary / ☐ Backup |

**Selected:** _TBD_  
**Sandbox credentials stored in:** _secrets manager / 1Password — not git_

## Banking-as-a-Service / virtual accounts

| Provider | Rails | Notes | Decision |
|---|---|---|---|
| _Regional BaaS_ | Local collections, USD/EUR VA | Needed for Phase 3 receive | ☐ |
| _Correspondent / EMI_ | SWIFT / SEPA | Diaspora + freelancers | ☐ |

**Selected:** _TBD_

## Mobile money / payout aggregator

| Provider | Corridors | Notes | Decision |
|---|---|---|---|
| _Pan-African aggregator_ | MoMo + bank | Prefer one API across markets | ☐ |
| _Single-market rail_ | e.g. NGN only | Acceptable for Phase 1 MVP | ☐ |

**MVP corridor target:** _e.g. NGN fund + NGN bank/MoMo payout_  
**Selected:** _TBD_

## Card issuing

| Provider | Notes | Decision |
|---|---|---|---|
| Marqeta | Global virtual cards | ☐ |
| Union54 | Africa-focused | ☐ |
| Regional processor | BIN + sponsorship required | ☐ |

**Selected:** _TBD (Phase 2)_

## FX rate feed

| Provider | Notes | Decision |
|---|---|---|---|
| Open Exchange Rates / similar | Mid-market reference | ☐ |
| Partner bank rates | May be required for treasury | ☐ |

**Selected:** _TBD (Phase 2)_

## Sanctions / PEP screening

| Provider | Notes | Decision |
|---|---|---|---|
| ComplyAdvantage / similar | Lists + ongoing monitoring | ☐ |
| KYC vendor add-on | Often bundled | ☐ |

**Selected:** _TBD_

## SMS / email / push

| Channel | Candidate | Decision |
|---|---|---|---|
| SMS OTP | Twilio / Africa's Talking / Termii | ☐ |
| Email | Resend / SES | ☐ |
| Push | FCM / APNs (mobile Phase 1+) | ☐ |

## Env placeholders

Partner names (not secrets) can be set in `.env`:

```
KYC_PROVIDER=
CARD_ISSUER=
BAAS_PROVIDER=
MOMO_AGGREGATOR=
FX_RATE_PROVIDER=
SANCTIONS_PROVIDER=
```
