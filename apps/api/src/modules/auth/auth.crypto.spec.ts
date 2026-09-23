import {
  generateOtpCode,
  hashOtp,
  safeEqualHex,
  ttlToSeconds,
} from './auth.crypto';

describe('auth.crypto', () => {
  it('hashes OTP deterministically', () => {
    const a = hashOtp('pepper', '+2348012345678', '123456');
    const b = hashOtp('pepper', '+2348012345678', '123456');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('safeEqualHex rejects mismatches', () => {
    const a = hashOtp('pepper', '+2348012345678', '123456');
    const b = hashOtp('pepper', '+2348012345678', '000000');
    expect(safeEqualHex(a, b)).toBe(false);
    expect(safeEqualHex(a, a)).toBe(true);
  });

  it('generates 6-digit OTP', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('parses TTL strings', () => {
    expect(ttlToSeconds('15m', 0)).toBe(900);
    expect(ttlToSeconds('30d', 0)).toBe(30 * 86400);
    expect(ttlToSeconds('bogus', 42)).toBe(42);
  });
});
