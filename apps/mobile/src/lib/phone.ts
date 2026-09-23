/** Normalize user input into E.164 when possible (NG default +234). */
export function toE164(input: string): string | null {
  const raw = input.trim().replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('8')) {
    return `+234${digits}`;
  }
  return null;
}

export function maskPhone(phone: string) {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)} ··· ${phone.slice(-4)}`;
}
