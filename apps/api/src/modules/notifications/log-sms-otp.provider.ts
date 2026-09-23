import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import type { SmsOtpProvider, SmsSendResult } from './sms-otp.interface';

/** Dev/test only — never selected in production. */
@Injectable()
export class LogSmsOtpProvider implements SmsOtpProvider {
  private readonly logger = new Logger(LogSmsOtpProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const env = this.config.get('NODE_ENV', { infer: true });
    if (env === 'production') {
      throw new Error('LogSmsOtpProvider cannot be used in production');
    }
    this.logger.warn(`[dev-otp] phone=${phone} code=${code}`);
    return Promise.resolve({ delivered: true, channel: 'dev-log' });
  }
}
