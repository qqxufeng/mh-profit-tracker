// ============================================================
// 梦幻搬砖收益账本 · 云版 — 前端 API 层 client/src/api/index.ts
// ============================================================
import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  MhUser, MhServer, MhRecord, MhPrice, MhGoldHistory,
  MarketServerListItem, MarketReference,
  AuthResponse, RegisterRequest, LoginRequest,
  FullSyncData, SyncResponse,
  StatsSummary, SourceDistributionItem, TrendPoint,
  AdminOverviewStats, AdminUserItem, AdminUserListResponse,
  AdminMarketServerItem, AdminMarketCreateRequest, AdminMarketUpdateRequest,
} from '@shared/api.interface';

async function request<T>(url: string, method: string, data?: unknown): Promise<T> {
  try {
    const response = await axiosForBackend({ url, method, data, withCredentials: true });
    return response.data as T;
  } catch (error) {
    logger.error('API请求失败', url, error);
    throw error;
  }
}

export const authApi = {
  register: (data: RegisterRequest) => request<AuthResponse>('/api/auth/register', 'POST', data),
  login: (data: LoginRequest) => request<AuthResponse>('/api/auth/login', 'POST', data),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', 'POST'),
  me: () => request<{ user: MhUser | null }>('/api/auth/me', 'GET'),
};

export const serversApi = {
  list: () => request<MhServer[]>('/api/servers', 'GET'),
  create: (data: { name: string; goldBase?: number; goldRate?: number }) =>
    request<MhServer>('/api/servers', 'POST', data),
  update: (id: string, data: { name?: string; goldBase?: number; goldRate?: number }) =>
    request<MhServer>(`/api/servers/${id}`, 'PATCH', data),
  remove: (id: string) => request<{ ok: boolean }>(`/api/servers/${id}`, 'DELETE'),
};

export const recordsApi = {
  list: (params: { serverId: string; from?: string; to?: string; limit?: number }) => {
    const search = new URLSearchParams();
    search.set('serverId', params.serverId);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (params.limit) search.set('limit', String(params.limit));
    return request<MhRecord[]>(`/api/records?${search.toString()}`, 'GET');
  },
  create: (data: Omit<MhRecord, 'id' | 'createdAt'>) =>
    request<MhRecord>('/api/records', 'POST', data),
  update: (id: string, data: Partial<Omit<MhRecord, 'id'>>) =>
    request<MhRecord>(`/api/records/${id}`, 'PATCH', data),
  remove: (id: string) => request<{ ok: boolean }>(`/api/records/${id}`, 'DELETE'),
  stats: (serverId: string) =>
    request<StatsSummary>(`/api/records/stats?serverId=${serverId}`, 'GET'),
  sourceDistribution: (serverId: string) =>
    request<SourceDistributionItem[]>(`/api/records/source-distribution?serverId=${serverId}`, 'GET'),
  trend: (serverId: string, days = 7) =>
    request<TrendPoint[]>(`/api/records/trend?serverId=${serverId}&days=${days}`, 'GET'),
};

export const pricesApi = {
  list: (serverId: string) => request<MhPrice[]>(`/api/prices?serverId=${serverId}`, 'GET'),
  create: (data: { serverId: string; name: string; category: string; price: number }) =>
    request<MhPrice>('/api/prices', 'POST', data),
  update: (id: string, data: { name?: string; category?: string; price?: number }) =>
    request<MhPrice>(`/api/prices/${id}`, 'PATCH', data),
  remove: (id: string) => request<{ ok: boolean }>(`/api/prices/${id}`, 'DELETE'),
};

export const goldHistoryApi = {
  list: (serverId: string, limit = 30) =>
    request<MhGoldHistory[]>(`/api/gold-history?serverId=${serverId}&limit=${limit}`, 'GET'),
  create: (data: { serverId: string; recordDate: string; goldBase: number; goldRate: number }) =>
    request<MhGoldHistory>('/api/gold-history', 'POST', data),
  remove: (id: string) => request<{ ok: boolean }>(`/api/gold-history/${id}`, 'DELETE'),
};

export const marketApi = {
  listServers: () => request<MarketServerListItem[]>('/api/market/servers', 'GET'),
  getServer: (id: string) => request<MarketReference>(`/api/market/servers/${id}`, 'GET'),
};

export const syncApi = {
  fullSync: (data: FullSyncData) =>
    request<SyncResponse>('/api/sync/full', 'POST', data),
  pull: () => request<SyncResponse>('/api/sync/pull', 'GET'),
};

// === 后台管理（仅管理员可用，403 保护） ===
export const adminApi = {
  overview: () =>
    request<AdminOverviewStats>('/api/admin/overview', 'GET'),
  listUsers: (params: { page?: number; pageSize?: number; search?: string }) => {
    const search = new URLSearchParams();
    search.set('page', String(params.page ?? 1));
    if (params.pageSize) search.set('pageSize', String(params.pageSize));
    if (params.search) search.set('search', params.search);
    return request<AdminUserListResponse>(`/api/admin/users?${search.toString()}`, 'GET');
  },
  setUserVip: (id: string, isVip: boolean) =>
    request<AdminUserItem>(`/api/admin/users/${id}/vip`, 'PATCH', { isVip }),
  setUserAdmin: (id: string, isAdmin: boolean) =>
    request<AdminUserItem>(`/api/admin/users/${id}/admin`, 'PATCH', { isAdmin }),
  resetUserPassword: (id: string, newPassword: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}/password`, 'PATCH', { newPassword }),
  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, 'DELETE'),
  listMarketServers: () =>
    request<AdminMarketServerItem[]>('/api/admin/market/servers', 'GET'),
  getMarketServer: (id: string) =>
    request<MarketReference>(`/api/admin/market/servers/${id}`, 'GET'),
  createMarketServer: (data: AdminMarketCreateRequest) =>
    request<MarketReference>('/api/admin/market/servers', 'POST', data),
  updateMarketServer: (id: string, data: AdminMarketUpdateRequest) =>
    request<MarketReference>(`/api/admin/market/servers/${id}`, 'PATCH', data),
  deleteMarketServer: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/market/servers/${id}`, 'DELETE'),
};
