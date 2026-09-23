import { useState } from 'react';
import { requestOtp, setToken, verifyOtp, type AdminUser } from '../api';

function normalizePhone(raw: string) {
  return raw.replace(/\s/g, '').trim();
}

export function LoginPage({
  onAuthed,
}: {
  onAuthed: (user: AdminUser) => void;
}) {
  const [phone, setPhone] = useState('+2348000000001');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [otpReady, setOtpReady] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError('Phone must be E.164, e.g. +2348000000001');
      return;
    }
    setPhone(normalized);
    setBusy(true);
    setError(null);
    setOtpReady(false);
    try {
      const res = await requestOtp(normalized);
      setOtpReady(true);
      if (res.devCode) {
        setCode(res.devCode);
        setHint(
          `Dev OTP: ${res.devCode} (from API). Tap Sign in — must request OTP after each API restart.`,
        );
      } else {
        setHint(
          'OTP sent via SMS. Enter the code from your phone (check API logs if SMS_OTP_MODE=log).',
        );
        setCode('');
      }
      setStep('code');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setError(
        msg === 'Failed to fetch'
          ? 'Cannot reach API. Start apps/api (`npm run start:dev`) then retry.'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    const normalized = normalizePhone(phone);
    const otp = code.trim();
    if (!otpReady) {
      setError('Tap “Request OTP” first, then Sign in.');
      return;
    }
    if (!otp) {
      setError('Enter the OTP code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(normalized, otp);
      if (
        res.user.platformRole !== 'admin' &&
        res.user.platformRole !== 'support'
      ) {
        throw new Error(
          'This account is not admin/support. Use +2348000000001 with ADMIN_SEED_PHONES and restart the API.',
        );
      }
      setToken(res.accessToken);
      onAuthed(res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>NovaPay Ops</h1>
        <p className="sub">
          Staff console for support, compliance, and ledger ops.
        </p>
        <div className="field">
          <label>Phone</label>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setOtpReady(false);
            }}
            placeholder="+2348000000001"
          />
        </div>
        {step === 'code' && (
          <div className="field">
            <label>OTP</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && otpReady && !busy) void login();
              }}
            />
          </div>
        )}
        {hint && <p className="sub">{hint}</p>}
        {error && <p className="error">{error}</p>}
        <div className="row">
          {step === 'phone' ? (
            <button type="button" disabled={busy} onClick={() => void sendOtp()}>
              Request OTP
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !otpReady}
                onClick={() => void login()}
              >
                Sign in
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void sendOtp()}
              >
                Resend OTP
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setStep('phone');
                  setOtpReady(false);
                  setHint(null);
                  setCode('');
                  setError(null);
                }}
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
