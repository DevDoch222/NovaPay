import { createHash, randomInt, timingSafeEqual } from 'crypto';

export function hashOtp(pepper: string, phone: string, code: string): string {
  return createHash('sha256')
    .update(`${pepper}:${phone}:${code}`)
    .digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

/** Parse Nest-style TTL strings like 15m, 30d into seconds. */
export function ttlToSeconds(ttl: string, fallbackSeconds: number): number {
  const m = /^(\d+)([smhd])$/i.exec(ttl.trim());
  if (!m) return fallbackSeconds;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return fallbackSeconds;
  }
}
