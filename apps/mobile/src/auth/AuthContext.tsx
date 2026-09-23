import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  clearPin,
  clearSession,
  getBiometricsEnabled,
  getKycSkipped,
  getPin,
  getPinSalt,
  loadSession,
  savePin,
  savePinSalt,
  saveSession,
  setBiometricsEnabled,
  setKycSkipped,
} from '@/lib/session';
import { createPinSalt, hashPin, isHashedPin } from '@/lib/pin-crypto';
import {
  fetchMe,
  logoutSession,
  refreshTokens,
  requestOtp,
  submitKyc,
  verifyOtp,
} from '@/lib/auth-api';
import {
  canUseBiometrics,
  promptBiometrics,
} from '@/lib/biometrics';
import type { AuthUser, KycSubmitResult, OtpRequestResult } from '@/lib/types';

type FetchOptions = {
  method?: string;
  body?: unknown;
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  pinSet: boolean;
  unlocked: boolean;
  biometricsEnabled: boolean;
  kycSkipped: boolean;
  pendingPhone: string | null;
  setPendingPhone: (phone: string | null) => void;
  sendOtp: (phone: string) => Promise<OtpRequestResult>;
  confirmOtp: (code: string) => Promise<void>;
  setupPin: (pin: string, enableBiometrics?: boolean) => Promise<void>;
  /** Change PIN after verifying the current one. */
  changePin: (currentPin: string, nextPin: string) => Promise<boolean>;
  updateBiometricsEnabled: (enabled: boolean) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: (
    promptMessage?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (input: {
    tag?: string;
    avatarUrl?: string | null;
  }) => Promise<AuthUser>;
  completeKyc: (input: {
    documentType: string;
    documentNumber: string;
    fullName?: string;
  }) => Promise<KycSubmitResult>;
  skipKyc: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Authenticated fetch — refreshes JWT on 401 once */
  authFetch: <T>(path: string, options?: FetchOptions) => Promise<T>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [biometricsEnabled, setBiometricsOn] = useState(false);
  const [kycSkipped, setKycSkippedState] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string> | null>(null);

  useEffect(() => {
    accessRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    refreshRef.current = refreshToken;
  }, [refreshToken]);

  const applyTokens = useCallback(
    async (tokens: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }) => {
      setAccessToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      setUser(tokens.user);
      accessRef.current = tokens.accessToken;
      refreshRef.current = tokens.refreshToken;
      await saveSession(tokens);
    },
    [],
  );

  const rotateTokens = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const currentRefresh = refreshRef.current;
    if (!currentRefresh) {
      throw new ApiError(401, null, 'Session expired — please sign in again');
    }

    refreshInFlight.current = (async () => {
      try {
        const refreshed = await refreshTokens(currentRefresh);
        await applyTokens(refreshed);
        return refreshed.accessToken;
      } catch {
        await clearSession();
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        accessRef.current = null;
        refreshRef.current = null;
        throw new ApiError(401, null, 'Session expired — please sign in again');
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [applyTokens]);

  const authFetch = useCallback(
    async <T,>(path: string, options: FetchOptions = {}): Promise<T> => {
      let token = accessRef.current;
      if (!token) {
        throw new ApiError(401, null, 'Not signed in');
      }

      try {
        return await apiFetch<T>(path, {
          method: options.method,
          body: options.body,
          token,
        });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        token = await rotateTokens();
        return apiFetch<T>(path, {
          method: options.method,
          body: options.body,
          token,
        });
      }
    },
    [rotateTokens],
  );

  // Keep a stable function identity for consumers that put authFetch in effect deps
  const authFetchStable = useRef(authFetch);
  authFetchStable.current = authFetch;
  const authFetchApi = useCallback(
    <T,>(path: string, options?: FetchOptions) =>
      authFetchStable.current<T>(path, options),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [session, pin, bio, skipped] = await Promise.all([
          loadSession(),
          getPin(),
          getBiometricsEnabled(),
          getKycSkipped(),
        ]);
        if (cancelled) return;

        setPinSet(Boolean(pin));
        setBiometricsOn(bio);
        setKycSkippedState(skipped);

        if (!session?.refreshToken && !session?.accessToken) {
          setReady(true);
          return;
        }

        let nextAccess = session.accessToken;
        let nextRefresh = session.refreshToken;
        let nextUser = session.user;

        try {
          if (nextAccess) {
            nextUser = await fetchMe(nextAccess);
          } else {
            throw new Error('no access');
          }
        } catch {
          if (!nextRefresh) throw new Error('session expired');
          const refreshed = await refreshTokens(nextRefresh);
          nextAccess = refreshed.accessToken;
          nextRefresh = refreshed.refreshToken;
          nextUser = refreshed.user;
          await saveSession(refreshed);
        }

        if (cancelled) return;
        setAccessToken(nextAccess);
        setRefreshToken(nextRefresh);
        setUser(nextUser);
        accessRef.current = nextAccess;
        refreshRef.current = nextRefresh;
        setUnlocked(!pin);
      } catch {
        await clearSession();
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
          setRefreshToken(null);
          accessRef.current = null;
          refreshRef.current = null;
          setUnlocked(false);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    const result = await requestOtp(phone);
    setPendingPhone(phone);
    return result;
  }, []);

  const confirmOtp = useCallback(
    async (code: string) => {
      if (!pendingPhone) throw new Error('Phone missing');
      const tokens = await verifyOtp(pendingPhone, code);
      await applyTokens(tokens);
      setPendingPhone(null);
      const pin = await getPin();
      setPinSet(Boolean(pin));
      setUnlocked(!pin);
      setKycSkippedState(false);
      await setKycSkipped(false);
    },
    [pendingPhone, applyTokens],
  );

  const setupPin = useCallback(async (pin: string, enableBiometrics = false) => {
    if (enableBiometrics) {
      const gate = await canUseBiometrics();
      if (!gate.available) {
        throw new Error(gate.reason ?? 'Biometrics unavailable');
      }
      const prompted = await promptBiometrics(`Enable ${gate.label} for NovaPay`);
      if (!prompted.success) {
        throw new Error(prompted.error ?? `${gate.label} was not confirmed`);
      }
    }
    const salt = await createPinSalt();
    const hashed = await hashPin(pin, salt);
    await savePinSalt(salt);
    await savePin(hashed);
    await setBiometricsEnabled(enableBiometrics);
    setPinSet(true);
    setBiometricsOn(enableBiometrics);
    setUnlocked(true);
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    const stored = await getPin();
    if (!stored) return false;
    if (isHashedPin(stored)) {
      const salt = await getPinSalt();
      if (!salt) return false;
      const hashed = await hashPin(pin, salt);
      return hashed === stored;
    }
    // Migrate legacy plaintext PIN once
    if (stored === pin) {
      const salt = await createPinSalt();
      const hashed = await hashPin(pin, salt);
      await savePinSalt(salt);
      await savePin(hashed);
      return true;
    }
    return false;
  }, []);

  const changePin = useCallback(
    async (currentPin: string, nextPin: string) => {
      const ok = await verifyPin(currentPin);
      if (!ok) return false;
      const salt = await createPinSalt();
      const hashed = await hashPin(nextPin, salt);
      await savePinSalt(salt);
      await savePin(hashed);
      setPinSet(true);
      return true;
    },
    [verifyPin],
  );

  const updateBiometricsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const gate = await canUseBiometrics();
      if (!gate.available) {
        throw new Error(gate.reason ?? 'Biometrics unavailable');
      }
      const prompted = await promptBiometrics(`Enable ${gate.label} for NovaPay`);
      if (!prompted.success) {
        throw new Error(prompted.error ?? `${gate.label} was not confirmed`);
      }
    }
    await setBiometricsEnabled(enabled);
    setBiometricsOn(enabled);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) setUnlocked(true);
    return ok;
  }, [verifyPin]);

  const unlockWithBiometrics = useCallback(async (promptMessage?: string) => {
    const enabled = await getBiometricsEnabled();
    if (!enabled) {
      return { ok: false, error: 'Biometrics are turned off in Profile' };
    }
    const gate = await canUseBiometrics();
    if (!gate.available) {
      return { ok: false, error: gate.reason };
    }
    const message = promptMessage ?? `Unlock NovaPay with ${gate.label}`;
    const result = await promptBiometrics(message);
    if (result.success) {
      setUnlocked(true);
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }, []);

  const updateProfile = useCallback(
    async (input: { tag?: string; avatarUrl?: string | null }) => {
      const next = await authFetchApi<AuthUser>('/v1/auth/profile', {
        method: 'PATCH',
        body: input,
      });
      setUser(next);
      if (accessRef.current && refreshRef.current) {
        await saveSession({
          accessToken: accessRef.current,
          refreshToken: refreshRef.current,
          user: next,
        });
      }
      return next;
    },
    [authFetchApi],
  );

  const completeKyc = useCallback(
    async (input: {
      documentType: string;
      documentNumber: string;
      fullName?: string;
    }) => {
      const result = await authFetchApi<KycSubmitResult>('/v1/auth/kyc', {
        method: 'POST',
        body: input,
      });
      const currentUser = user;
      if (result.kycTier && currentUser) {
        const next = { ...currentUser, kycTier: result.kycTier };
        setUser(next);
        if (accessRef.current && refreshRef.current) {
          await saveSession({
            accessToken: accessRef.current,
            refreshToken: refreshRef.current,
            user: next,
          });
        }
      } else {
        const me = await authFetchApi<AuthUser>('/v1/auth/me');
        setUser(me);
        if (accessRef.current && refreshRef.current) {
          await saveSession({
            accessToken: accessRef.current,
            refreshToken: refreshRef.current,
            user: me,
          });
        }
      }
      await setKycSkipped(false);
      setKycSkippedState(false);
      return result;
    },
    [authFetchApi, user],
  );

  const skipKyc = useCallback(async () => {
    await setKycSkipped(true);
    setKycSkippedState(true);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authFetchApi<AuthUser>('/v1/auth/me');
      setUser(me);
      if (accessRef.current && refreshRef.current) {
        await saveSession({
          accessToken: accessRef.current,
          refreshToken: refreshRef.current,
          user: me,
        });
      }
    } catch {
      /* authFetch already rotates or clears session */
    }
  }, [authFetchApi]);

  const signOut = useCallback(async () => {
    const currentRefresh = refreshRef.current;
    try {
      if (currentRefresh) {
        await logoutSession(currentRefresh);
      }
    } catch {
      /* still clear local session */
    }
    await clearSession();
    await clearPin();
    await setBiometricsEnabled(false);
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    accessRef.current = null;
    refreshRef.current = null;
    setPinSet(false);
    setUnlocked(false);
    setBiometricsOn(false);
    setKycSkippedState(false);
    setPendingPhone(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      accessToken,
      pinSet,
      unlocked,
      biometricsEnabled,
      kycSkipped,
      pendingPhone,
      setPendingPhone,
      sendOtp,
      confirmOtp,
      setupPin,
      changePin,
      updateBiometricsEnabled,
      unlockWithPin,
      unlockWithBiometrics,
      updateProfile,
      completeKyc,
      skipKyc,
      refreshUser,
      authFetch: authFetchApi,
      signOut,
    }),
    [
      ready,
      user,
      accessToken,
      pinSet,
      unlocked,
      biometricsEnabled,
      kycSkipped,
      pendingPhone,
      sendOtp,
      confirmOtp,
      setupPin,
      changePin,
      updateBiometricsEnabled,
      unlockWithPin,
      unlockWithBiometrics,
      updateProfile,
      completeKyc,
      skipKyc,
      refreshUser,
      authFetchApi,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
