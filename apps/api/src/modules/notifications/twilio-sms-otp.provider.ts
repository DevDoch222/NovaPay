import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { SmsOtpProvider, SmsSendResult } from './sms-otp.interface';

/** Twilio Messages API (form-urlencoded). */
@Injectable()
export class TwilioSmsOtpProvider implements SmsOtpProvider {
  private readonly logger = new Logger(TwilioSmsOtpProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const sid = this.config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = this.config.get('TWILIO_AUTH_TOKEN', { infer: true });
    const from = this.config.get('TWILIO_FROM_NUMBER', { infer: true });
    if (!sid || !token || !from) {
      throw new Error(
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER required',
      );
    }

    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your NovaPay code is ${code}. It expires in 5 minutes.`,
    });

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Twilio failed ${res.status}: ${text}`);
        throw new Error(`Twilio SMS failed (${res.status})`);
      }
      const json = (await res.json()) as { sid?: string };
      return {
        delivered: true,
        channel: 'twilio',
        providerRef: json.sid,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
