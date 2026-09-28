// ============================================================
// 梦幻搬砖收益账本 · 云版 — 数据同步模块 sync.service.ts
// 同步策略（事务内合并，防重复）：
//  - servers：按 name 去重，同名则更新金价和排序
//  - records：按 localId 去重，避免重复写入
//  - prices：按 serverId+name 去重，同名则更新价格
//  - goldHistory：按 serverId+recordDate 去重，同日不重复
// ============================================================
import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, inArray } from 'drizzle-orm';
import type {
  SyncResponse,
  FullSyncData,
  MhServer,
  MhRecord,
  MhPrice,
  MhGoldHistory,
} from '@shared/api.interface';
import {
  mhServer,
  mhRecord,
  mhPrice,
  mhGoldHistory,
  mhUser,
} from '@server/database/schema';
import { FullSyncDataDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toServer(row: typeof mhServer.$inferSelect): MhServer {
    return {
      id: row.id,
      name: row.name,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
      sortOrder: row.sortOrder,
    };
  }

  private toRecord(row: typeof mhRecord.$inferSelect): MhRecord {
    const rd: unknown = row.recordDate;
    const recordDate =
      rd instanceof Date
        ? rd.toISOString().slice(0, 10)
        : String(rd);
    return {
      id: row.id,
      serverId: row.serverId,
      recordDate,
      kind: row.kind as MhRecord['kind'],
      itemName: row.itemName,
      price: Number(row.price),
      qty: row.qty,
      source: row.source,
      note: row.note,
      localId: row.localId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toPrice(row: typeof mhPrice.$inferSelect): MhPrice {
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      category: row.category,
      price: Number(row.price),
    };
  }

  private toGoldHistory(row: typeof mhGoldHistory.$inferSelect): MhGoldHistory {
    const rd: unknown = row.recordDate;
    const recordDate =
      rd instanceof Date
        ? rd.toISOString().slice(0, 10)
        : String(rd);
    return {
      id: row.id,
      serverId: row.serverId,
      recordDate,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
    };
  }

  async pull(userId: string): Promise<SyncResponse> {
    const [servers, records, prices, goldHistory, users] = await Promise.all([
      this.db.select().from(mhServer).where(eq(mhServer.userId, userId)),
      this.db.select().from(mhRecord).where(eq(mhRecord.userId, userId)),
      this.db.select().from(mhPrice).where(eq(mhPrice.userId, userId)),
      this.db.select().from(mhGoldHistory).where(eq(mhGoldHistory.userId, userId)),
      this.db
        .select({ lastSyncAt: mhUser.lastSyncAt })
        .from(mhUser)
        .where(eq(mhUser.id, userId))
        .limit(1),
    ]);

    const lastSyncAt = users[0]?.lastSyncAt?.toISOString() ?? new Date().toISOString();

    return {
      servers: servers.map((s) => this.toServer(s)),
      records: records.map((r) => this.toRecord(r)),
      prices: prices.map((p) => this.toPrice(p)),
      goldHistory: goldHistory.map((g) => this.toGoldHistory(g)),
      mergedCount: 0,
    };
  }

  async fullSync(userId: string, data: FullSyncDataDto): Promise<SyncResponse> {
    let mergedCount = 0;
    const now = new Date();
    const nowIso = now.toISOString();

    await this.db.transaction(async (tx) => {
      // 1. 合并 servers（按 name 去重）
      const localServers = data.servers ?? [];
      const serverIdMap = new Map<string, string>();

      if (localServers.length > 0) {
        const existingServers = await tx
          .select()
          .from(mhServer)
          .where(
            and(
              eq(mhServer.userId, userId),
              inArray(mhServer.name, localServers.map((s) => s.name)),
            ),
          );

        const existingByName = new Map(existingServers.map((s) => [s.name, s]));

        for (const localSrv of localServers) {
          const existing = existingByName.get(localSrv.name);
          if (existing) {
            serverIdMap.set(localSrv.id, existing.id);
            if (
              existing.goldBase !== localSrv.goldBase ||
              Number(existing.goldRate) !== localSrv.goldRate ||
              existing.sortOrder !== localSrv.sortOrder
            ) {
              await tx.update(mhServer).set({
                goldBase: localSrv.goldBase,
                goldRate: String(localSrv.goldRate),
                sortOrder: localSrv.sortOrder,
              }).where(eq(mhServer.id, existing.id));
            }
          } else {
            const inserted = await tx.insert(mhServer).values({
              userId,
              name: localSrv.name,
              goldBase: localSrv.goldBase,
              goldRate: String(localSrv.goldRate),
              sortOrder: localSrv.sortOrder,
            }).returning();
            serverIdMap.set(localSrv.id, inserted[0].id);
            mergedCount += 1;
          }
        }
      }

      const resolveServerId = (localId: string): string => {
        const realId = serverIdMap.get(localId);
        if (!realId) throw new BadRequestException(`记录引用了不存在的服务器: ${localId}`);
        return realId;
      };

      // 2. 合并 records（按 localId 去重）
      const localRecords = data.records ?? [];
      if (localRecords.length > 0) {
        const localIds = localRecords.filter((r) => r.localId).map((r) => r.localId as string);
        const existingLocalIds = new Set<string>();
        if (localIds.length > 0) {
          const existing = await tx
            .select({ localId: mhRecord.localId })
            .from(mhRecord)
            .where(and(eq(mhRecord.userId, userId), inArray(mhRecord.localId, localIds)));
          for (const row of existing) {
            if (row.localId) existingLocalIds.add(row.localId);
          }
        }
        const toInsert = localRecords.filter(
          (r) => !r.localId || !existingLocalIds.has(r.localId),
        );
        for (const rec of toInsert) {
          const realServerId = resolveServerId(rec.serverId);
          await tx.insert(mhRecord).values({
            userId,
            serverId: realServerId,
            recordDate: rec.recordDate,
            kind: rec.kind,
            itemName: rec.itemName,
            price: String(rec.price),
            qty: rec.qty,
            source: rec.source,
            note: rec.note ?? null,
            localId: rec.localId ?? null,
          });
          mergedCount += 1;
        }
      }

      // 3. 合并 prices（按 serverId+name 去重，价格不同则更新）
      const localPrices = data.prices ?? [];
      if (localPrices.length > 0 && serverIdMap.size > 0) {
        const realServerIds = Array.from(new Set(
          localPrices.map((p) => resolveServerId(p.serverId)),
        ));
        const existingPrices = await tx.select().from(mhPrice).where(
          and(eq(mhPrice.userId, userId), inArray(mhPrice.serverId, realServerIds)),
        );
        const existingKey = new Map(existingPrices.map((p) => [`${p.serverId}:${p.name}`, p]));

        for (const lp of localPrices) {
          const realServerId = resolveServerId(lp.serverId);
          const key = `${realServerId}:${lp.name}`;
          const existing = existingKey.get(key);
          if (existing) {
            if (Number(existing.price) !== lp.price) {
              await tx.update(mhPrice).set({ price: String(lp.price) })
                .where(eq(mhPrice.id, existing.id));
            }
          } else {
            await tx.insert(mhPrice).values({
              userId, serverId: realServerId, name: lp.name,
              category: lp.category, price: String(lp.price),
            });
            mergedCount += 1;
          }
        }
      }

      // 4. 合并 goldHistory（按 serverId+recordDate 去重）
      const localGoldHistory = data.goldHistory ?? [];
      if (localGoldHistory.length > 0 && serverIdMap.size > 0) {
        const realServerIds = Array.from(new Set(
          localGoldHistory.map((g) => resolveServerId(g.serverId)),
        ));
        const existingGh = await tx.select().from(mhGoldHistory).where(
          and(eq(mhGoldHistory.userId, userId), inArray(mhGoldHistory.serverId, realServerIds)),
        );
        const existingKey = new Set(existingGh.map((g) => {
          const rd: unknown = g.recordDate;
          return `${g.serverId}:${rd instanceof Date ? rd.toISOString().slice(0, 10) : String(rd)}`;
        }));

        for (const lgh of localGoldHistory) {
          const realServerId = resolveServerId(lgh.serverId);
          const key = `${realServerId}:${lgh.recordDate}`;
          if (!existingKey.has(key)) {
            await tx.insert(mhGoldHistory).values({
              userId, serverId: realServerId, recordDate: lgh.recordDate,
              goldBase: lgh.goldBase, goldRate: String(lgh.goldRate),
            });
            mergedCount += 1;
          }
        }
      }

      // 5. 更新 lastSyncAt
      await tx.update(mhUser).set({ lastSyncAt: now }).where(eq(mhUser.id, userId));
    });

    // 6. 返回完整云端数据
    const [servers, records, prices, goldHistory] = await Promise.all([
      this.db.select().from(mhServer).where(eq(mhServer.userId, userId)),
      this.db.select().from(mhRecord).where(eq(mhRecord.userId, userId)),
      this.db.select().from(mhPrice).where(eq(mhPrice.userId, userId)),
      this.db.select().from(mhGoldHistory).where(eq(mhGoldHistory.userId, userId)),
    ]);

    return {
      servers: servers.map((s) => this.toServer(s)),
      records: records.map((r) => this.toRecord(r)),
      prices: prices.map((p) => this.toPrice(p)),
      goldHistory: goldHistory.map((g) => this.toGoldHistory(g)),
      lastSyncAt: nowIso,
      mergedCount,
    };
  }
}
