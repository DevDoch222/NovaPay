import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { LogSmsOtpProvider } from './log-sms-otp.provider';
import { HttpSmsOtpProvider } from './http-sms-otp.provider';
import { TwilioSmsOtpProvider } from './twilio-sms-otp.provider';
import { InfobipSmsOtpProvider } from './infobip-sms-otp.provider';
import { SMS_OTP_PROVIDER, type SmsOtpProvider } from './sms-otp.interface';
import type { Env } from '../../config/env.validation';

@Module({
  providers: [
    NotificationsService,
    LogSmsOtpProvider,
    HttpSmsOtpProvider,
    TwilioSmsOtpProvider,
    InfobipSmsOtpProvider,
    {
      provide: SMS_OTP_PROVIDER,
      inject: [
        ConfigService,
        LogSmsOtpProvider,
        HttpSmsOtpProvider,
        TwilioSmsOtpProvider,
        InfobipSmsOtpProvider,
      ],
      useFactory: (
        config: ConfigService<Env, true>,
        log: LogSmsOtpProvider,
        http: HttpSmsOtpProvider,
        twilio: TwilioSmsOtpProvider,
        infobip: InfobipSmsOtpProvider,
      ): SmsOtpProvider => {
        const mode = config.get('SMS_OTP_MODE', { infer: true });
        if (mode === 'infobip') return infobip;
        if (mode === 'twilio') return twilio;
        if (mode === 'http') return http;
        return log;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
