// ============================================================
// 梦幻搬砖收益账本 · 云版 — 前后端共享类型契约
// ============================================================

export interface MhUser {
  id: string;
  username: string;
  isVip: boolean;
  lastSyncAt?: string;
}

export type RecordKind = 'item' | 'in' | 'out';

export interface MhRecord {
  id: string;
  serverId: string;
  recordDate: string;
  kind: RecordKind;
  itemName: string;
  price: number;
  qty: number;
  source: string;
  note: string | null;
  localId: string | null;
  createdAt: string;
}

export interface MhServer {
  id: string;
  name: string;
  goldBase: number;
  goldRate: number;
  sortOrder: number;
}

export interface MhPrice {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface MhGoldHistory {
  id: string;
  serverId: string;
  recordDate: string;
  goldBase: number;
  goldRate: number;
}

export interface MarketServerListItem {
  id: string;
  serverName: string;
  goldBase: number;
  goldRate: number;
  updatedAt: string;
}

export interface MarketReference {
  id: string;
  serverName: string;
  goldBase: number;
  goldRate: number;
  priceData: { items: { name: string; category: string; price: number }[] };
  updatedAt: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: MhUser;
}

export interface StatsSummary {
  todayWan: number;
  todayYuan: number;
  weekWan: number;
  weekYuan: number;
  monthWan: number;
  monthYuan: number;
}

export interface SourceDistributionItem {
  source: string;
  amount: number;
  percent: number;
}

export interface TrendPoint {
  date: string;
  amount: number;
}

export interface FullSyncData {
  servers: MhServer[];
  records: MhRecord[];
  prices: MhPrice[];
  goldHistory: MhGoldHistory[];
}

export interface SyncResponse {
  servers: MhServer[];
  records: MhRecord[];
  prices: MhPrice[];
  goldHistory: MhGoldHistory[];
  mergedCount: number;
}
