import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_USD_EUR_MID,
  DEFAULT_USD_NGN_MID,
} from '../../common/constants';
import type { Env } from '../../config/env.validation';
import type { FxRateProvider } from './rate-provider.interface';

@Injectable()
export class StaticFxRateProvider implements FxRateProvider {
  readonly name = 'static';

  constructor(private readonly config: ConfigService<Env, true>) {}

  getMidRate(source: string, dest: string): Promise<number> {
    const usdOf = this.usdPerUnit(source);
    const usdOfDest = this.usdPerUnit(dest);
    if (usdOfDest <= 0) {
      return Promise.reject(new Error(`Unsupported FX dest ${dest}`));
    }
    return Promise.resolve(usdOf / usdOfDest);
  }

  usdPerUnit(currency: string): number {
    const ngnPerUsd = Number(
      this.config.get('FX_USD_NGN_MID', { infer: true }) ?? DEFAULT_USD_NGN_MID,
    );
    const eurPerUsd = Number(
      this.config.get('FX_USD_EUR_MID', { infer: true }) ?? DEFAULT_USD_EUR_MID,
    );
    switch (currency) {
      case 'USD':
        return 1;
      case 'NGN':
        return 1 / ngnPerUsd;
      case 'EUR':
        return 1 / eurPerUsd;
      default:
        throw new Error(`Unsupported FX currency ${currency}`);
    }
  }
}
