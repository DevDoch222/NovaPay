# Phase 0 — Regulatory pathway

This is a **legal/compliance** workstream. Engineering cannot substitute for counsel.

## Decisions required before MVP launch

| Decision | Options | Owner | Status |
|---|---|---|---|
| Primary launch market | e.g. Nigeria, Kenya, multi-corridor via partner | Founders | ☐ |
| License model | Own EMI/PSP vs partner with licensed bank/EMI | Founders + counsel | ☐ |
| Customer funds custody | Where float sits (partner bank / EMI safeguarding) | Counsel + BaaS | ☐ |
| Data protection | NDPR (NG), GDPR (EU diaspora), others | Counsel | ☐ |
| Card issuance | Issuer BIN sponsorship / processor PCI boundary | Cards partner | ☐ |

## Recommended approach for a startup MVP

1. **Partner with an already-licensed EMI/bank/BaaS** for the first corridor instead of waiting on a full license.
2. Keep NovaPay out of full **PCI-DSS Level 1** by tokenizing cards at the issuer (never store PANs).
3. Map KYC tiers to transaction limits before go-live.
4. Document AML monitoring + SAR escalation even if tooling is manual at first.

## Per-market notes (fill in with counsel)

### Nigeria
- Possible paths: CBN PSP / payment service frameworks, or partner EMI.
- ID rails: BVN / NIN lookups via licensed identity providers.
- Privacy: NDPR.

### Kenya / East Africa
- Mobile-money heavy; payouts often via M-Pesa aggregators under partner licenses.
- Confirm who is the licensed money transmitter for customer funds.

### Diaspora (UK/EU senders)
- Cross-border remit may trigger EMI / payment institution rules where senders reside.
- GDPR if processing EU-resident personal data.

## Phase 0 output artifact

Produce a one-pager:

1. Launch country + corridor (e.g. `NGN wallet → NGN bank payout`)
2. Licensed entity that moves money
3. NovaPay’s role (tech platform vs licensed institution)
4. Target license timeline if pursuing own license in parallel
