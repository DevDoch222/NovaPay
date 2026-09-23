import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeesService } from './fees.service';

describe('FeesService', () => {
  let fees: FeesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeesService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, number> = {
                FEE_FUND_BPS: 50,
                FEE_FUND_FLAT_MINOR: 0,
                FEE_PAYOUT_BPS: 100,
                FEE_PAYOUT_FLAT_MINOR: 5000,
                FEE_CARD_SPEND_BPS: 0,
                FEE_CARD_SPEND_FLAT_MINOR: 0,
                FEE_CARD_ISSUE_FLAT_MINOR: 0,
                FEE_BILL_BPS: 0,
                FEE_BILL_FLAT_MINOR: 0,
                FEE_MIN_MINOR: 0,
                FEE_MAX_MINOR: 0,
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();
    fees = moduleRef.get(FeesService);
  });

  it('quotes fund fee as bps of amount', () => {
    // ₦10,000 = 1_000_000 kobo; 50 bps = 0.5% = 5_000 kobo
    const quote = fees.quoteFromMajor('fund', 10_000, 'NGN');
    expect(quote.feeMinor).toBe('5000');
    expect(quote.netMinor).toBe('995000');
  });

  it('quotes payout fee as bps + flat', () => {
    // ₦1,000 = 100_000 kobo; 100 bps = 1_000 + flat 5_000 = 6_000
    const quote = fees.quoteFromMajor('payout', 1_000, 'NGN');
    expect(quote.feeMinor).toBe('6000');
    expect(quote.netMinor).toBe('106000');
  });
});
