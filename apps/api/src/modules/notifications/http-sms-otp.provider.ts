import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { SmsOtpProvider, SmsSendResult } from './sms-otp.interface';

/**
 * Generic HTTP SMS gateway.
 * POST JSON { phone, code, message } with optional Bearer key.
 */
@Injectable()
export class HttpSmsOtpProvider implements SmsOtpProvider {
  private readonly logger = new Logger(HttpSmsOtpProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const url = this.config.get('SMS_HTTP_URL', { infer: true });
    const apiKey = this.config.get('SMS_HTTP_API_KEY', { infer: true });
    if (!url) {
      throw new Error('SMS_HTTP_URL is required when SMS_OTP_MODE=http');
    }

    const message = `Your NovaPay code is ${code}. It expires in 5 minutes.`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ phone, code, message }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`SMS HTTP failed ${res.status}: ${text}`);
        throw new Error(`SMS provider HTTP ${res.status}`);
      }
      return { delivered: true, channel: 'http' };
    } finally {
      clearTimeout(timer);
    }
  }
}
