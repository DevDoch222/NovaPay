import { Inject, Injectable } from '@nestjs/common';
import {
  SMS_OTP_PROVIDER,
  type SmsOtpProvider,
} from './sms-otp.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SMS_OTP_PROVIDER) private readonly sms: SmsOtpProvider,
  ) {}

  sendOtp(phone: string, code: string) {
    return this.sms.sendOtp(phone, code);
  }

  notify(userId: string, event: string, payload: Record<string, unknown>) {
    // Placeholder for push/email — keep structured log only
    console.log(`[notify] user=${userId} event=${event}`, payload);
    return Promise.resolve({ queued: true });
  }
}
