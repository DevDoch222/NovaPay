export const FX_RATE_PROVIDER = Symbol('FX_RATE_PROVIDER');

export interface FxRateProvider {
  /** Dest units received per 1 source unit (mid-market). */
  getMidRate(source: string, dest: string): Promise<number>;
  readonly name: string;
}
