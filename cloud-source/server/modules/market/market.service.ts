// ============================================================
// 梦幻搬砖收益账本 · 云版 — 行情参考模块 market.service.ts
// 行情参考数据来自 mh_market_reference 表，由运营/脚本维护，应用端只读
// ============================================================
import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc } from 'drizzle-orm';
import { mhMarketReference } from '@server/database/schema';
import type { MarketReference } from '@shared/api.interface';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async listServers(): Promise<MarketServerListItem[]> {
    const rows = await this.db
      .select({
        id: mhMarketReference.id,
        serverName: mhMarketReference.serverName,
        goldBase: mhMarketReference.goldBase,
        goldRate: mhMarketReference.goldRate,
        updatedAt: mhMarketReference.updatedAt,
      })
      .from(mhMarketReference)
      .orderBy(desc(mhMarketReference.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      serverName: row.serverName,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getServer(id: string): Promise<MarketReference> {
    const rows = await this.db
      .select()
      .from(mhMarketReference)
      .where(eq(mhMarketReference.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException('行情参考服务器不存在');
    const row = rows[0];
    return {
      id: row.id,
      serverName: row.serverName,
      goldBase: row.goldBase,
      goldRate: Number(row.goldRate),
      priceData: row.priceData as MarketReference['priceData'],
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
