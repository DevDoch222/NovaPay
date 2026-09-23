import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  CollectionInput,
  PaymentRailProvider,
  PayoutInput,
  RailInitiateResult,
} from './payment-rail.interface';

/**
 * Sandbox rail for local testing without Flutterwave.
 * Collections complete via /simulate-complete.
 * Payouts auto-complete immediately.
 */
@Injectable()
export class MockPaymentRailProvider implements PaymentRailProvider {
  readonly name = 'mock';

  initiateCollection(_input: CollectionInput): Promise<RailInitiateResult> {
    void _input;
    return Promise.resolve({
      providerRef: `mock_col_${randomUUID()}`,
      status: 'pending',
      message: 'Use POST /v1/payments/fund/:id/simulate-complete',
    });
  }

  initiatePayout(_input: PayoutInput): Promise<RailInitiateResult> {
    void _input;
    return Promise.resolve({
      providerRef: `mock_pay_${randomUUID()}`,
      status: 'completed',
    });
  }
}
