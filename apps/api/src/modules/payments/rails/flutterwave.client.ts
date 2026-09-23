import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';

type FlwResponse<T> = {
  status: string;
  message: string;
  data: T;
};

@Injectable()
export class FlutterwaveClient {
  private readonly logger = new Logger(FlutterwaveClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured() {
    return Boolean(this.config.get('FLW_SECRET_KEY', { infer: true }));
  }

  async getBanks(country = 'NG') {
    return this.request<Array<{ id: number; code: string; name: string }>>(
      'GET',
      `/banks/${country}`,
    );
  }

  async createPayment(input: {
    txRef: string;
    amountMajor: number;
    currency: string;
    redirectUrl: string;
    customer: { email: string; phonenumber?: string; name?: string };
  }) {
    return this.request<{
      link: string;
      status?: string;
    }>('POST', '/payments', {
      tx_ref: input.txRef,
      amount: input.amountMajor,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      customer: input.customer,
      customizations: {
        title: 'NovaPay',
        description: 'Wallet funding',
      },
    });
  }

  async createTransfer(input: {
    accountBank: string;
    accountNumber: string;
    amountMajor: number;
    currency: string;
    reference: string;
    narration?: string;
    beneficiaryName?: string;
  }) {
    return this.request<{
      id: number;
      account_number: string;
      bank_code: string;
      full_name: string;
      amount: number;
      currency: string;
      status: string;
      reference: string;
    }>('POST', '/transfers', {
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount: input.amountMajor,
      currency: input.currency,
      reference: input.reference,
      narration: input.narration ?? 'NovaPay payout',
      beneficiary_name: input.beneficiaryName,
    });
  }

  async verifyTransaction(idOrRef: string) {
    return this.request<{
      id: number;
      tx_ref: string;
      flw_ref: string;
      amount: number;
      currency: string;
      status: string;
    }>('GET', `/transactions/${idOrRef}/verify`);
  }

  async listTransactions(filters: { from: string; to: string; page?: number }) {
    const page = filters.page ?? 1;
    const qs = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      page: String(page),
    });
    const data = await this.request<
      | Array<{
          id: number;
          tx_ref: string;
          flw_ref: string;
          amount: number;
          currency: string;
          status: string;
        }>
      | {
          page_info?: unknown;
          transactions?: Array<{
            id: number;
            tx_ref: string;
            flw_ref: string;
            amount: number;
            currency: string;
            status: string;
          }>;
        }
    >('GET', `/transactions?${qs.toString()}`);

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.transactions)) return data.transactions;
    return [];
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const secret = this.config.get('FLW_SECRET_KEY', { infer: true });
    if (!secret) {
      throw new ServiceUnavailableException(
        'Flutterwave secret key not configured',
      );
    }

    const base = this.config.get('FLW_BASE_URL', { infer: true });
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as FlwResponse<T> & { message?: string };
    if (!res.ok || json.status !== 'success') {
      this.logger.warn(`Flutterwave ${method} ${path} failed: ${json.message}`);
      throw new BadRequestException(
        json.message ?? `Flutterwave request failed (${res.status})`,
      );
    }
    return json.data;
  }
}
