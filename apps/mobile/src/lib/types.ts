export type KycTier = 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3';

export type AuthUser = {
  id: string;
  phone: string;
  tag: string;
  avatarUrl?: string | null;
  kycTier: KycTier;
  status: string;
  email?: string | null;
  createdAt?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: AuthUser;
};

export type OtpRequestResult = {
  phone: string;
  expiresInSeconds: number;
  devCode?: string;
};

export type KycSubmitResult = {
  id: string;
  status: string;
  kycTier?: KycTier;
  message: string;
};
