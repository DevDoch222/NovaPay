import { Injectable } from '@nestjs/common';
import type {
  SanctionsCheckResult,
  SanctionsProvider,
} from './sanctions.interface';

const HIGH_RISK_COUNTRIES = new Set(['KP', 'IR', 'SY', 'CU']);

const BLACKLIST = [
  'saddam hussein',
  'osama bin laden',
  'kim jong un',
  'sanctioned party',
];

@Injectable()
export class MockSanctionsProvider implements SanctionsProvider {
  checkName(name: string, country?: string): Promise<SanctionsCheckResult> {
    const normalized = name.toLowerCase().trim();
    const hit = BLACKLIST.find(
      (blocked) =>
        normalized.includes(blocked) || blocked.includes(normalized),
    );
    if (hit) {
      return Promise.resolve({
        cleared: false,
        score: 1,
        matchDetails: `Mock SDN match: ${hit}`,
        provider: 'mock',
      });
    }
    if (country && HIGH_RISK_COUNTRIES.has(country.toUpperCase())) {
      return Promise.resolve({
        cleared: false,
        score: 1,
        matchDetails: `High-risk country ${country}`,
        provider: 'mock',
      });
    }
    return Promise.resolve({
      cleared: true,
      score: 0,
      provider: 'mock',
    });
  }
}
