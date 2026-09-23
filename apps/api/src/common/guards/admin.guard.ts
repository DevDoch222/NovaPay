import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ADMIN_ROLES_KEY,
  type AuthUser,
  type PlatformRole,
} from '../decorators';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Admin access required');
    }

    const allowed =
      this.reflector.getAllAndOverride<PlatformRole[]>(ADMIN_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? (['admin', 'support'] as PlatformRole[]);

    const role = user.platformRole ?? 'customer';
    if (!allowed.includes(role)) {
      throw new ForbiddenException(
        `Requires platform role: ${allowed.join('|')}`,
      );
    }
    return true;
  }
}
