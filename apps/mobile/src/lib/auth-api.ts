import { apiFetch } from './api';
import type {
  AuthUser,
  KycSubmitResult,
  OtpRequestResult,
  TokenPair,
} from './types';

export function requestOtp(phone: string) {
  return apiFetch<OtpRequestResult>('/v1/auth/otp/request', {
    method: 'POST',
    body: { phone },
  });
}

export function verifyOtp(phone: string, code: string) {
  return apiFetch<TokenPair>('/v1/auth/otp/verify', {
    method: 'POST',
    body: { phone, code },
  });
}

export function refreshTokens(refreshToken: string) {
  return apiFetch<TokenPair>('/v1/auth/token/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function logoutSession(refreshToken: string) {
  return apiFetch<{ ok: boolean }>('/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}

export function requestStepUp(accessToken: string) {
  return apiFetch<{ expiresInSeconds: number; devCode?: string }>(
    '/v1/auth/step-up/request',
    { method: 'POST', token: accessToken },
  );
}

export function verifyStepUp(accessToken: string, code: string) {
  return apiFetch<{ ok: boolean; expiresInSeconds: number }>(
    '/v1/auth/step-up/verify',
    { method: 'POST', token: accessToken, body: { code } },
  );
}

export function fetchMe(accessToken: string) {
  return apiFetch<AuthUser>('/v1/auth/me', { token: accessToken });
}

export function submitKyc(
  accessToken: string,
  input: { documentType: string; documentNumber: string; fullName?: string },
) {
  return apiFetch<KycSubmitResult>('/v1/auth/kyc', {
    method: 'POST',
    token: accessToken,
    body: input,
  });
}
