// ============================================================
// 梦幻搬砖收益账本 · 云版 — 后台管理守卫 admin.guard.ts
// 非管理员一律 403（管理员身份来自数据库 is_admin 字段，不含硬编码账号）
// ============================================================
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, verifyToken } from '../auth/auth.service';
import { COOKIE_NAME } from '../auth/auth.guard';

import type { MhUser } from '@shared/api.interface';

function parseCookie(raw: string | undefined, name: string): string | null {
  if (!raw) return null;
  const pairs = raw.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieHeader =
      typeof req.headers.cookie === 'string'
        ? req.headers.cookie
        : undefined;
    const token =
      parseCookie(cookieHeader, COOKIE_NAME) ??
      (req.cookies?.[COOKIE_NAME] as string | undefined) ??
      null;

    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new UnauthorizedException('登录已过期');
    }

    const user: MhUser | null = await this.authService.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.isAdmin) {
      throw new ForbiddenException('需要管理员权限');
    }

    req.mhUser = user;
    return true;
  }
}
