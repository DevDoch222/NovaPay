import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ADMIN_ROLES_KEY = 'adminRoles';
export type PlatformRole = 'customer' | 'support' | 'admin';
export const AdminRoles = (...roles: PlatformRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);

export type AuthUser = {
  userId: string;
  phone: string;
  kycTier: string;
  platformRole?: PlatformRole;
  authType?: 'jwt' | 'api_key';
  apiKeyId?: string;
  scopes?: string[];
  organizationId?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
