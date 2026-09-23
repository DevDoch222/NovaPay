import { KYC_LIMITS } from '../../common/constants';
import { MockSanctionsProvider } from './mock-sanctions.provider';

describe('Phase 7 compliance', () => {
  describe('KYC_LIMITS', () => {
    it('defines daily and monthly fund/payout caps per tier', () => {
      expect(KYC_LIMITS.tier_0.maxSinglePayoutMinor).toBe(0n);
      expect(KYC_LIMITS.tier_1.maxDailyPayoutMinor).toBeGreaterThan(
        KYC_LIMITS.tier_1.maxSinglePayoutMinor,
      );
      expect(KYC_LIMITS.tier_2.maxMonthlyFundMinor).toBeGreaterThan(
        KYC_LIMITS.tier_2.maxDailyFundMinor,
      );
    });
  });

  describe('MockSanctionsProvider', () => {
    const provider = new MockSanctionsProvider();

    it('clears normal names', async () => {
      const result = await provider.checkName('Ada Lovelace', 'NG');
      expect(result.cleared).toBe(true);
      expect(result.provider).toBe('mock');
    });

    it('blocks high-risk countries', async () => {
      const result = await provider.checkName('Someone', 'KP');
      expect(result.cleared).toBe(false);
      expect(result.matchDetails).toMatch(/High-risk country/);
    });

    it('blocks blacklist names', async () => {
      const result = await provider.checkName('Sanctioned Party', 'US');
      expect(result.cleared).toBe(false);
    });
  });
});
