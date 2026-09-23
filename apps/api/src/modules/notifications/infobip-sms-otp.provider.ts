import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { SmsOtpProvider, SmsSendResult } from './sms-otp.interface';

/**
 * Infobip SMS API — POST /sms/3/messages
 * Auth: Authorization: App {API_KEY}
 * Docs: https://www.infobip.com/docs/sms/api
 */
@Injectable()
export class InfobipSmsOtpProvider implements SmsOtpProvider {
  private readonly logger = new Logger(InfobipSmsOtpProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const baseUrl = this.config
      .get('INFOBIP_BASE_URL', { infer: true })
      .replace(/\/$/, '');
    const apiKey = this.config.get('INFOBIP_API_KEY', { infer: true });
    const sender = this.config.get('INFOBIP_SENDER', { infer: true });

    if (!baseUrl || !apiKey || !sender) {
      throw new Error(
        'INFOBIP_BASE_URL, INFOBIP_API_KEY, and INFOBIP_SENDER are required',
      );
    }

    const to = phone.replace(/^\+/, '');
    const text = `Your NovaPay code is ${code}. It expires in 5 minutes. Do not share this code.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${baseUrl}/sms/3/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `App ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              sender,
              destinations: [{ to }],
              content: { text },
            },
          ],
        }),
      });

      const bodyText = await res.text();
      if (!res.ok) {
        this.logger.error(`Infobip SMS failed ${res.status}: ${bodyText}`);
        throw new Error(`Infobip SMS failed (${res.status})`);
      }

      let messageId: string | undefined;
      try {
        const json = JSON.parse(bodyText) as {
          messages?: Array<{ messageId?: string }>;
        };
        messageId = json.messages?.[0]?.messageId;
      } catch {
        /* ignore parse */
      }

      return {
        delivered: true,
        channel: 'infobip',
        providerRef: messageId,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
