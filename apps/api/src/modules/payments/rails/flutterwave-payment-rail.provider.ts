import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { FlutterwaveClient } from './flutterwave.client';
import type {
  CollectionInput,
  PaymentRailProvider,
  PayoutInput,
  RailInitiateResult,
} from './payment-rail.interface';

@Injectable()
export class FlutterwavePaymentRailProvider implements PaymentRailProvider {
  readonly name = 'flutterwave';

  constructor(
    private readonly flw: FlutterwaveClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async initiateCollection(
    input: CollectionInput,
  ): Promise<RailInitiateResult> {
    const amountMajor = Number(input.amountMinor / 100n);
    if (!Number.isFinite(amountMajor) || amountMajor < 1) {
      throw new BadRequestException('Invalid funding amount');
    }

    const appUrl = this.config.get('APP_URL', { infer: true });
    const email =
      input.customerEmail ??
      `user-${input.userId.replace(/-/g, '').slice(0, 12)}@novapay.local`;

    const data = await this.flw.createPayment({
      txRef: input.reference,
      amountMajor,
      currency: input.currency,
      redirectUrl: `${appUrl}/v1/payments/flutterwave/return`,
      customer: {
        email,
        phonenumber: input.customerPhone,
        name: input.customerName ?? 'NovaPay User',
      },
    });

    return {
      providerRef: input.reference,
      status: 'pending',
      paymentLink: data.link,
      message: 'Open paymentLink to complete funding, then wait for webhook',
    };
  }

  async initiatePayout(input: PayoutInput): Promise<RailInitiateResult> {
    if (!input.bankCode) {
      throw new BadRequestException(
        'bankCode is required for Flutterwave NGN bank payouts',
      );
    }

    const amountMajor = Number(input.amountMinor / 100n);
    const data = await this.flw.createTransfer({
      accountBank: input.bankCode,
      accountNumber: input.accountNumber,
      amountMajor,
      currency: input.currency,
      reference: input.reference.slice(0, 100),
      beneficiaryName: input.accountName,
      narration: input.narration ?? 'NovaPay payout',
    });

    const status = String(data.status || '').toLowerCase();
    return {
      providerRef: String(data.id ?? data.reference ?? input.reference),
      status:
        status === 'successful' || status === 'success'
          ? 'completed'
          : status === 'failed'
            ? 'failed'
            : 'processing',
    };
  }
}
