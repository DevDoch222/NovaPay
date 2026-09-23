export const SANCTIONS_PROVIDER = Symbol('SANCTIONS_PROVIDER');

export type SanctionsCheckResult = {
  cleared: boolean;
  score: number;
  matchDetails?: string;
  provider: string;
};

export interface SanctionsProvider {
  checkName(name: string, country?: string): Promise<SanctionsCheckResult>;
}
