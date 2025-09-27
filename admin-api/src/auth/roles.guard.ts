import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RolesGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) { super(); }

  async canActivate(ctx: ExecutionContext) {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] =
      req.user?.roles ??
      req.user?.realm_access?.roles ??
      [];

    return required.some(r => roles.includes(r));
  }
}