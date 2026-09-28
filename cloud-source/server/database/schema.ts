// ============================================================
// 梦幻搬砖收益账本 · 云版 — 数据库表结构（Drizzle ORM / PostgreSQL）
// ============================================================
import { sql } from 'drizzle-orm';
import {
  boolean, date, integer, jsonb, numeric, pgTable,
  uniqueIndex, uuid, varchar, customType, index,
} from 'drizzle-orm/pg-core';

// 自定义类型：timestamptz（自动 Date <-> ISO 字符串转换）
export const customTimestamptz = customType<{ data: Date; driverData: string }>({
  // 实现略（由 drizzle-kit 生成）
});

// === 用户表 ===
export const mhUser = pgTable('mh_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isVip: boolean('is_vip').notNull().default(true),
  lastSyncAt: customTimestamptz('last_sync_at', { precision: 3 }),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('mh_user_username_key').on(table.username),
]);

// === 服务器表 ===
export const mhServer = pgTable('mh_server', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  goldBase: integer('gold_base').notNull().default(3000),
  goldRate: numeric('gold_rate').notNull().default('218.00'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('mh_server_user_id_name_key').on(table.userId, table.name),
  index('idx_mh_server_user_id').on(table.userId),
]);

// === 记账记录表 ===
export const mhRecord = pgTable('mh_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  serverId: uuid('server_id').notNull(),
  recordDate: date('record_date').notNull(),
  kind: varchar('kind', { length: 16 }).notNull(),  // item / in / out
  itemName: varchar('item_name', { length: 128 }).notNull(),
  price: numeric('price').notNull(),
  qty: integer('qty').notNull().default(1),
  source: varchar('source', { length: 32 }).notNull(),
  note: varchar('note', { length: 255 }),
  localId: varchar('local_id', { length: 64 }),    // 本地ID，用于同步去重
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_mh_record_user_server_date').on(table.userId, table.serverId, table.recordDate),
  index('idx_mh_record_local_id').on(table.userId, table.localId),
]);

// === 估价表 ===
export const mhPrice = pgTable('mh_price', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  serverId: uuid('server_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  category: varchar('category', { length: 32 }).notNull(),
  price: numeric('price').notNull(),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: customTimestamptz('_updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('mh_price_user_id_server_id_name_key').on(table.userId, table.serverId, table.name),
  index('idx_mh_price_user_server').on(table.userId, table.serverId),
]);

// === 金价历史表 ===
export const mhGoldHistory = pgTable('mh_gold_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  serverId: uuid('server_id').notNull(),
  recordDate: date('record_date').notNull(),
  goldBase: integer('gold_base').notNull(),
  goldRate: numeric('gold_rate').notNull(),
  createdAt: customTimestamptz('_created_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('mh_gold_history_user_id_server_id_record_date_key').on(table.userId, table.serverId, table.recordDate),
  index('idx_mh_gold_user_server_date').on(table.userId, table.serverId, table.recordDate),
]);

// === 行情参考表（全区服物价金价，只读） ===
export const mhMarketReference = pgTable('mh_market_reference', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverName: varchar('server_name', { length: 64 }).notNull().unique(),
  goldBase: integer('gold_base').notNull(),
  goldRate: numeric('gold_rate').notNull(),
  /** @type { items: { name: string; category: string; price: number }[] } */
  priceData: jsonb('price_data').notNull(),
  updatedAt: customTimestamptz('updated_at', { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('mh_market_reference_server_name_key').on(table.serverName),
]);
