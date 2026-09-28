// ============================================================
// 梦幻搬砖收益账本 · 云版 — 记账记录模块 records.service.ts
// 统计口径：净值 = 物品 qty×price + 金币收入 price − 金币支出 price
// ============================================================
import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type {
  MhRecord,
  StatsSummary,
  SourceDistributionItem,
  TrendPoint,
} from '@shared/api.interface';
import { mhRecord, mhServer } from '@server/database/schema';
import { CreateRecordDto } from './dto/create-record.dto';
import { UpdateRecordDto } from './dto/update-record.dto';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private calcAmount(kind: string, price: number, qty: number): number {
    if (kind === 'item') return qty * price;
    if (kind === 'in') return price;
    return -price;
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

  async list(
    userId: string,
    serverId: string,
    params: { from?: string; to?: string; limit?: number },
  ): Promise<MhRecord[]> {
    const limit = params.limit ?? 200;
    const conditions = [eq(mhRecord.userId, userId), eq(mhRecord.serverId, serverId)];
    if (params.from) conditions.push(gte(mhRecord.recordDate, params.from));
    if (params.to) conditions.push(lte(mhRecord.recordDate, params.to));

    const rows = await this.db
      .select()
      .from(mhRecord)
      .where(and(...conditions))
      .orderBy(desc(mhRecord.recordDate), desc(mhRecord.createdAt))
      .limit(limit);

    return rows.map((row) => this.toRecord(row));
  }

  async create(userId: string, dto: CreateRecordDto): Promise<MhRecord> {
    const rows = await this.db
      .insert(mhRecord)
      .values({
        userId,
        serverId: dto.serverId,
        recordDate: dto.recordDate,
        kind: dto.kind,
        itemName: dto.itemName,
        price: String(dto.price),
        qty: dto.qty,
        source: dto.source,
        note: dto.note ?? null,
        localId: dto.localId ?? null,
      })
      .returning();

    if (rows.length === 0) {
      throw new BadRequestException('创建记录失败');
    }
    return this.toRecord(rows[0]);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecordDto,
  ): Promise<MhRecord> {
    const patch: Partial<typeof mhRecord.$inferInsert> = {};
    if (dto.serverId !== undefined) patch.serverId = dto.serverId;
    if (dto.recordDate !== undefined) patch.recordDate = dto.recordDate;
    if (dto.kind !== undefined) patch.kind = dto.kind;
    if (dto.itemName !== undefined) patch.itemName = dto.itemName;
    if (dto.price !== undefined) patch.price = String(dto.price);
    if (dto.qty !== undefined) patch.qty = dto.qty;
    if (dto.source !== undefined) patch.source = dto.source;
    if (dto.note !== undefined) patch.note = dto.note;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const rows = await this.db
      .update(mhRecord)
      .set(patch)
      .where(and(eq(mhRecord.id, id), eq(mhRecord.userId, userId)))
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException('记录不存在');
    }
    return this.toRecord(rows[0]);
  }

  async remove(userId: string, id: string): Promise<void> {
    const rows = await this.db
      .delete(mhRecord)
      .where(and(eq(mhRecord.id, id), eq(mhRecord.userId, userId)))
      .returning({ id: mhRecord.id });

    if (rows.length === 0) {
      throw new NotFoundException('记录不存在');
    }
  }

  private async getServerGold(
    userId: string,
    serverId: string,
  ): Promise<{ goldBase: number; goldRate: number }> {
    const rows = await this.db
      .select({ goldBase: mhServer.goldBase, goldRate: mhServer.goldRate })
      .from(mhServer)
      .where(and(eq(mhServer.id, serverId), eq(mhServer.userId, userId)))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('服务器不存在');
    }
    return {
      goldBase: rows[0].goldBase,
      goldRate: Number(rows[0].goldRate),
    };
  }

  private toWan(amount: number, goldBase: number): number {
    if (goldBase <= 0) return 0;
    return Math.round((amount / goldBase) * 100) / 100;
  }

  private toYuan(amount: number, goldBase: number, goldRate: number): number {
    const wan = this.toWan(amount, goldBase);
    return Math.round(wan * goldRate * 100) / 100;
  }

  private async sumAmountInRange(
    userId: string,
    serverId: string,
    from: string,
    to: string,
  ): Promise<number> {
    const result = await this.db
      .select({
        total: sql<number>`
          coalesce(sum(
            case
              when ${mhRecord.kind} = 'item' then (${mhRecord.price}::numeric * ${mhRecord.qty})
              when ${mhRecord.kind} = 'in' then ${mhRecord.price}::numeric
              else -(${mhRecord.price}::numeric)
            end
          ), 0)
        `,
      })
      .from(mhRecord)
      .where(
        and(
          eq(mhRecord.userId, userId),
          eq(mhRecord.serverId, serverId),
          gte(mhRecord.recordDate, from),
          lte(mhRecord.recordDate, to),
        ),
      );

    return Number(result[0]?.total ?? 0);
  }

  async getStats(userId: string, serverId: string): Promise<StatsSummary> {
    const { goldBase, goldRate } = await this.getServerGold(userId, serverId);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const [todayAmount, weekAmount, monthAmount] = await Promise.all([
      this.sumAmountInRange(userId, serverId, todayStr, todayStr),
      this.sumAmountInRange(userId, serverId, weekStartStr, weekEndStr),
      this.sumAmountInRange(userId, serverId, monthStartStr, monthEndStr),
    ]);

    return {
      todayWan: this.toWan(todayAmount, goldBase),
      todayYuan: this.toYuan(todayAmount, goldBase, goldRate),
      weekWan: this.toWan(weekAmount, goldBase),
      weekYuan: this.toYuan(weekAmount, goldBase, goldRate),
      monthWan: this.toWan(monthAmount, goldBase),
      monthYuan: this.toYuan(monthAmount, goldBase, goldRate),
    };
  }

  async getSourceDistribution(
    userId: string,
    serverId: string,
  ): Promise<SourceDistributionItem[]> {
    const todayStr = new Date().toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        source: mhRecord.source,
        amount: sql<number>`
          sum(
            case
              when ${mhRecord.kind} = 'item' then (${mhRecord.price}::numeric * ${mhRecord.qty})
              when ${mhRecord.kind} = 'in' then ${mhRecord.price}::numeric
              else 0
            end
          )
        `,
      })
      .from(mhRecord)
      .where(
        and(
          eq(mhRecord.userId, userId),
          eq(mhRecord.serverId, serverId),
          eq(mhRecord.recordDate, todayStr),
          sql`${mhRecord.kind} <> 'out'`,
        ),
      )
      .groupBy(mhRecord.source)
      .orderBy((fields) => desc(fields.amount));

    const items = rows.map((row) => ({
      source: row.source,
      amount: Number(row.amount),
    }));

    const total = items.reduce((sum: number, item) => sum + item.amount, 0);

    return items.map((item) => ({
      source: item.source,
      amount: item.amount,
      percent: total > 0 ? Math.round((item.amount / total) * 10000) / 100 : 0,
    }));
  }

  async getTrend(
    userId: string,
    serverId: string,
    days: number,
  ): Promise<TrendPoint[]> {
    const n = Math.max(1, Math.min(365, days));
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (n - 1));
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        date: mhRecord.recordDate,
        amount: sql<number>`
          sum(
            case
              when ${mhRecord.kind} = 'item' then (${mhRecord.price}::numeric * ${mhRecord.qty})
              when ${mhRecord.kind} = 'in' then ${mhRecord.price}::numeric
              else -(${mhRecord.price}::numeric)
            end
          )
        `,
      })
      .from(mhRecord)
      .where(
        and(
          eq(mhRecord.userId, userId),
          eq(mhRecord.serverId, serverId),
          gte(mhRecord.recordDate, startStr),
          lte(mhRecord.recordDate, endStr),
        ),
      )
      .groupBy(mhRecord.recordDate)
      .orderBy(mhRecord.recordDate);

    const map = new Map<string, number>();
    for (const row of rows) {
      const d: unknown = row.date;
      const dateStr =
        d instanceof Date
          ? d.toISOString().slice(0, 10)
          : String(d);
      map.set(dateStr, Number(row.amount));
    }

    const result: TrendPoint[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({
        date: dateStr,
        amount: map.get(dateStr) ?? 0,
      });
    }
    return result;
  }
}
