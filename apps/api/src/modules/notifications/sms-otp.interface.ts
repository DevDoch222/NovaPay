export const SMS_OTP_PROVIDER = Symbol('SMS_OTP_PROVIDER');

export type SmsSendResult = {
  delivered: boolean;
  channel: string;
  providerRef?: string;
};

export interface SmsOtpProvider {
  sendOtp(phone: string, code: string): Promise<SmsSendResult>;
}
