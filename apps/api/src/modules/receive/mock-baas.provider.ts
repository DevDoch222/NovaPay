import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';

export type IssuedVirtualAccount = {
  provider: string;
  providerRef: string;
  accountNumber: string;
  routingNumber?: string;
  iban?: string;
  bic?: string;
  bankName: string;
  accountName: string;
  country: string;
};

@Injectable()
export class MockBaasProvider {
  readonly name = 'mock-baas';

  issueVirtualAccount(input: {
    userId: string;
    currency: 'USD' | 'EUR';
    accountName: string;
  }): Promise<IssuedVirtualAccount> {
    const providerRef = `va_${input.currency.toLowerCase()}_${randomUUID()}`;
    if (input.currency === 'USD') {
      return Promise.resolve({
        provider: this.name,
        providerRef,
        accountNumber: String(randomInt(100000000, 999999999)),
        routingNumber: '021000021',
        bankName: 'NovaPay Partner Bank (Sandbox)',
        accountName: input.accountName,
        country: 'US',
      });
    }
    const ibanCheck = String(randomInt(10, 99));
    const accountCore = String(randomInt(1e10, 9e10));
    return Promise.resolve({
      provider: this.name,
      providerRef,
      accountNumber: accountCore,
      iban: `DE${ibanCheck}10010010${accountCore.slice(0, 10)}`,
      bic: 'NOVASANDBOX',
      bankName: 'NovaPay SEPA Partner (Sandbox)',
      accountName: input.accountName,
      country: 'DE',
    });
  }
}
