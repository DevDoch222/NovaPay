import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';

export type IssuedCard = {
  processorRef: string;
  brand: 'visa' | 'mastercard';
  last4: string;
  expMonth: string;
  expYear: string;
};

@Injectable()
export class MockCardIssuer {
  readonly name = 'mock';

  issue(input: {
    userId: string;
    currency: string;
    label?: string;
    form?: 'virtual' | 'physical';
  }): Promise<IssuedCard> {
    const now = new Date();
    const prefix = input.form === 'physical' ? 'mock_pcard' : 'mock_card';
    return Promise.resolve({
      processorRef: `${prefix}_${randomUUID()}`,
      brand: 'visa',
      last4: String(randomInt(1000, 9999)),
      expMonth: String(now.getMonth() + 1).padStart(2, '0'),
      expYear: String(now.getFullYear() + 3),
    });
  }
}
