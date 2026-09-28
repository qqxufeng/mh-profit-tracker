// ============================================================
// 梦幻搬砖收益账本 · 云版 — 认证守卫 auth.guard.ts
// 无 token 时放行并置 req.mhUser = null（= 未登录本地模式）
// ============================================================
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, verifyToken } from './auth.service';
import type { MhUser } from '@shared/api.interface';

export const COOKIE_NAME = 'mh_session';

declare module 'express' {
  interface Request {
    mhUser?: MhUser | null;
  }
}

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
      try { return decodeURIComponent(value); } catch { return value; }
    }
  }
  return null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined;
    const token = parseCookie(cookieHeader, COOKIE_NAME)
      ?? (req.cookies?.[COOKIE_NAME] as string | undefined)
      ?? null;

    if (!token) {
      req.mhUser = null;
      return true;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      req.mhUser = null;
      return true;
    }

    const user = await this.authService.findById(decoded.sub);
    req.mhUser = user;
    return true;
  }
}
