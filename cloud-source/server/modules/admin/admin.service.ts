// ============================================================
// 梦幻搬砖收益账本 · 云版 — 后台管理服务 admin.service.ts
// 概览统计 / 用户管理（VIP、管理员、重置密码、删除）/ 行情管理
// 密码重置使用 scrypt 哈希（salt:derived），不存明文
// ============================================================
import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, like, count, sql, and, gte } from 'drizzle-orm';
import { scryptSync, randomBytes } from 'node:crypto';

import {
  mhUser,
  mhRecord,
  mhPrice,
  mhGoldHistory,
  mhMarketReference,
} from '@server/database/schema';
import type {
  AdminOverviewStats,
  AdminUserItem,
  AdminUserListResponse,
  AdminMarketServerItem,
  AdminMarketCreateRequest,
  AdminMarketUpdateRequest,
  MarketReference,
} from '@shared/api.interface';

const SCRYPT_KEYLEN = 32;
const SALT_LEN = 16;

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

interface UserWithCountRow {
  id: string;
  username: string;
  isVip: boolean;
  isAdmin: boolean;
  createdAt: Date;
  lastSyncAt: Date | null;
  recordCount: number;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toAdminUserItem(row: UserWithCountRow): AdminUserItem {
    return {
      id: row.id,
      username: row.username,
      isVip: row.isVip,
      isAdmin: row.isAdmin,
      createdAt: row.createdAt.toISOString(),
      lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
      recordCount: Number(row.recordCount),
    };
  }

  private toMarketServerItem(
    row: typeof mhMarketReference.$inferSelect,
  ): AdminMarketServerItem {
    const priceData = row.priceData as { items: unknown[] };
    return {
      id: row.id,
      serverName: row.serverName,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
      itemCount: Array.isArray(priceData?.items) ? priceData.items.length : 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMarketReference(
    row: typeof mhMarketReference.$inferSelect,
  ): MarketReference {
    return {
      id: row.id,
      serverName: row.serverName,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
      priceData: row.priceData as MarketReference['priceData'],
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getOverview(): Promise<AdminOverviewStats> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsersResult,
      todayNewUsersResult,
      totalRecordsResult,
      totalPricesResult,
      totalGoldHistoryResult,
    ] = await Promise.all([
      this.db.select({ count: count() }).from(mhUser),
      this.db
        .select({ count: count() })
        .from(mhUser)
        .where(gte(mhUser.createdAt, todayStart)),
      this.db.select({ count: count() }).from(mhRecord),
      this.db.select({ count: count() }).from(mhPrice),
      this.db.select({ count: count() }).from(mhGoldHistory),
    ]);

    const activeUsers7dResult = await this.db
      .select({
        count: sql<number>`count(distinct ${mhRecord.userId})`,
      })
      .from(mhRecord)
      .where(gte(mhRecord.createdAt, sevenDaysAgo));

    return {
      totalUsers: Number(totalUsersResult[0]?.count ?? 0),
      todayNewUsers: Number(todayNewUsersResult[0]?.count ?? 0),
      totalRecords: Number(totalRecordsResult[0]?.count ?? 0),
      totalPrices: Number(totalPricesResult[0]?.count ?? 0),
      totalGoldHistory: Number(totalGoldHistoryResult[0]?.count ?? 0),
      activeUsers7d: Number(activeUsers7dResult[0]?.count ?? 0),
    };
  }

  async listUsers(
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<AdminUserListResponse> {
    const offset = (page - 1) * pageSize;

    const whereConditions = [];
    if (search && search.trim()) {
      whereConditions.push(like(mhUser.username, `%${search.trim()}%`));
    }

    const [totalResult, rows] = await Promise.all([
      whereConditions.length > 0
        ? this.db
            .select({ count: count() })
            .from(mhUser)
            .where(and(...whereConditions))
        : this.db.select({ count: count() }).from(mhUser),
      this.db
        .select({
          id: mhUser.id,
          username: mhUser.username,
          isVip: mhUser.isVip,
          isAdmin: mhUser.isAdmin,
          createdAt: mhUser.createdAt,
          lastSyncAt: mhUser.lastSyncAt,
          recordCount: sql<number>`coalesce((
            select count(*) from ${mhRecord}
            where ${mhRecord.userId} = ${mhUser.id}
          ), 0)`,
        })
        .from(mhUser)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(mhUser.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    return {
      items: rows.map((row) => this.toAdminUserItem(row)),
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async setUserVip(userId: string, isVip: boolean): Promise<AdminUserItem> {
    const updated = await this.db
      .update(mhUser)
      .set({ isVip })
      .where(eq(mhUser.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const recordCountResult = await this.db
      .select({ count: count() })
      .from(mhRecord)
      .where(eq(mhRecord.userId, userId));

    return this.toAdminUserItem({
      ...updated[0],
      recordCount: Number(recordCountResult[0]?.count ?? 0),
    });
  }

  async setUserAdmin(
    userId: string,
    isAdmin: boolean,
  ): Promise<AdminUserItem> {
    if (!isAdmin) {
      const adminCountResult = await this.db
        .select({ count: count() })
        .from(mhUser)
        .where(eq(mhUser.isAdmin, true));
      const adminCount: number = Number(adminCountResult[0]?.count ?? 0);

      const targetUser = await this.db
        .select({ isAdmin: mhUser.isAdmin })
        .from(mhUser)
        .where(eq(mhUser.id, userId))
        .limit(1);

      if (targetUser.length === 0) {
        throw new NotFoundException('用户不存在');
      }

      if (targetUser[0].isAdmin && adminCount <= 1) {
        throw new BadRequestException('不能取消最后一个管理员');
      }
    }

    const updated = await this.db
      .update(mhUser)
      .set({ isAdmin })
      .where(eq(mhUser.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const recordCountResult = await this.db
      .select({ count: count() })
      .from(mhRecord)
      .where(eq(mhRecord.userId, userId));

    return this.toAdminUserItem({
      ...updated[0],
      recordCount: Number(recordCountResult[0]?.count ?? 0),
    });
  }

  async resetUserPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('密码长度不能少于6位');
    }

    const passwordHash: string = hashPassword(newPassword);
    const updated = await this.db
      .update(mhUser)
      .set({ passwordHash })
      .where(eq(mhUser.id, userId))
      .returning({ id: mhUser.id });

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return { ok: true };
  }

  async deleteUser(userId: string): Promise<{ ok: true }> {
    const deleted = await this.db
      .delete(mhUser)
      .where(eq(mhUser.id, userId))
      .returning({ id: mhUser.id });

    if (deleted.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return { ok: true };
  }

  async listMarketServers(): Promise<AdminMarketServerItem[]> {
    const rows = await this.db
      .select()
      .from(mhMarketReference)
      .orderBy(desc(mhMarketReference.updatedAt));

    return rows.map((row) => this.toMarketServerItem(row));
  }

  async getMarketServer(id: string): Promise<MarketReference> {
    const rows = await this.db
      .select()
      .from(mhMarketReference)
      .where(eq(mhMarketReference.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('行情参考服务器不存在');
    }
    return this.toMarketReference(rows[0]);
  }

  async createMarketServer(
    data: AdminMarketCreateRequest,
  ): Promise<MarketReference> {
    const priceData = { items: data.items };
    const inserted = await this.db
      .insert(mhMarketReference)
      .values({
        serverName: data.serverName,
        goldBase: data.goldBase,
        goldRate: String(data.goldRate),
        priceData,
      })
      .returning();

    return this.toMarketReference(inserted[0]);
  }

  async updateMarketServer(
    id: string,
    data: AdminMarketUpdateRequest,
  ): Promise<MarketReference> {
    const patch: Partial<typeof mhMarketReference.$inferInsert> = {};
    if (data.serverName !== undefined) patch.serverName = data.serverName;
    if (data.goldBase !== undefined) patch.goldBase = data.goldBase;
    if (data.goldRate !== undefined) patch.goldRate = String(data.goldRate);
    if (data.items !== undefined) patch.priceData = { items: data.items };

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (patch as any).updatedAt = new Date();

    const updated = await this.db
      .update(mhMarketReference)
      .set(patch)
      .where(eq(mhMarketReference.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('行情参考服务器不存在');
    }

    return this.toMarketReference(updated[0]);
  }

  async deleteMarketServer(id: string): Promise<{ ok: true }> {
    const deleted = await this.db
      .delete(mhMarketReference)
      .where(eq(mhMarketReference.id, id))
      .returning({ id: mhMarketReference.id });

    if (deleted.length === 0) {
      throw new NotFoundException('行情参考服务器不存在');
    }

    return { ok: true };
  }
}
