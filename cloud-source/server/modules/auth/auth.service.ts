// ============================================================
// 梦幻搬砖收益账本 · 云版 — 认证模块 auth.service.ts
// ============================================================
import { Inject, Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

import { mhUser } from '@server/database/schema';
import type { MhUser } from '@shared/api.interface';

// JWT 密钥只从环境变量读取，公开仓库不落任何默认密钥
const JWT_SECRET = process.env.MH_JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('缺少环境变量 MH_JWT_SECRET，请配置后启动（生产环境必须使用强随机密钥）');
}
const JWT_EXPIRES_IN = '30d';
const SALT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  exp: number;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function toMhUser(row: typeof mhUser.$inferSelect): MhUser {
  return {
    id: row.id,
    username: row.username,
    isVip: row.isVip,
    isAdmin: row.isAdmin,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : undefined,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async register(username: string, password: string): Promise<{ user: MhUser; token: string }> {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed.length > 32) {
      throw new ConflictException('用户名长度需在 3-32 个字符之间');
    }
    if (password.length < 6) {
      throw new ConflictException('密码至少 6 位');
    }

    const existing = await this.db.select().from(mhUser).where(eq(mhUser.username, trimmed)).limit(1);
    if (existing.length > 0) {
      throw new ConflictException('用户名已被注册');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const inserted = await this.db.insert(mhUser).values({
      username: trimmed,
      passwordHash,
      isVip: true,
    }).returning();

    const user = toMhUser(inserted[0]);
    const token = signToken(user.id);
    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: MhUser; token: string }> {
    const trimmed = username.trim().toLowerCase();
    const rows = await this.db.select().from(mhUser).where(eq(mhUser.username, trimmed)).limit(1);
    if (rows.length === 0) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const row = rows[0];
    const valid = await bcrypt.compare(password, row.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user = toMhUser(row);
    const token = signToken(user.id);
    return { user, token };
  }

  async findById(userId: string): Promise<MhUser | null> {
    const rows = await this.db.select().from(mhUser).where(eq(mhUser.id, userId)).limit(1);
    return rows.length > 0 ? toMhUser(rows[0]) : null;
  }
}
