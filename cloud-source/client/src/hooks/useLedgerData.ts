// ============================================================
// 梦幻搬砖收益账本 · 云版 — 统一数据层 client/src/hooks/useLedgerData.ts
// 云端 / 本地双模式自动切换：
//  - 未登录：数据走 useLocalStore（localStorage）
//  - 已登录：登录时自动 fullSync 把本地数据合并到云端，之后走 API
//  - 派生数据（今日记录、统计、趋势、来源分布）两种模式同口径计算
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from './useAuth';
import { useLocalStore } from './useLocalStore';
import { serversApi, recordsApi, pricesApi, goldHistoryApi, syncApi } from '@client/src/api';
import type {
  MhServer, MhRecord, MhPrice, MhGoldHistory, FullSyncData,
  StatsSummary, SourceDistributionItem, TrendPoint,
} from '@shared/api.interface';
import { todayStr } from '@client/src/utils/format';

const ACTIVE_SERVER_KEY = 'mh_active_server';

interface CloudState {
  servers: MhServer[];
  records: MhRecord[];
  prices: MhPrice[];
  goldHistory: MhGoldHistory[];
}

export function useLedgerData() {
  const { user } = useAuth();
  const local = useLocalStore();

  const [cloudState, setCloudState] = useState<CloudState>({
    servers: [], records: [], prices: [], goldHistory: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeServerId, setActiveServerIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_SERVER_KEY);
  });
  const [synced, setSynced] = useState(false);

  const isCloud = user !== null;

  const setActiveServerId = useCallback((id: string) => {
    setActiveServerIdState(id);
    localStorage.setItem(ACTIVE_SERVER_KEY, id);
  }, []);

  const servers: MhServer[] = isCloud ? cloudState.servers : local.data.servers;
  const prices: MhPrice[] = isCloud ? cloudState.prices : local.data.prices;
  const records: MhRecord[] = isCloud ? cloudState.records : local.data.records;
  const goldHistory: MhGoldHistory[] = isCloud ? cloudState.goldHistory : local.data.goldHistory;

  const activeServer: MhServer | null = useMemo(() => {
    if (servers.length === 0) return null;
    const found = servers.find(s => s.id === activeServerId);
    return found ?? servers[0];
  }, [servers, activeServerId]);

  const serverPrices: MhPrice[] = useMemo(() => {
    if (!activeServer) return [];
    return prices.filter(p => p.serverId === activeServer.id);
  }, [prices, activeServer]);

  const serverRecords: MhRecord[] = useMemo(() => {
    if (!activeServer) return [];
    return records.filter(r => r.serverId === activeServer.id);
  }, [records, activeServer]);

  const serverGoldHistory: MhGoldHistory[] = useMemo(() => {
    if (!activeServer) return [];
    return goldHistory.filter(g => g.serverId === activeServer.id);
  }, [goldHistory, activeServer]);

  // --- Cloud refresh helpers ---
  const refreshServers = useCallback(async () => {
    if (!user) return;
    try {
      const data = await serversApi.list();
      setCloudState(prev => ({ ...prev, servers: data }));
    } catch (e) { logger.error('刷新服务器列表失败', e); }
  }, [user]);

  const refreshRecords = useCallback(async () => {
    if (!user || !activeServer) return;
    try {
      const data = await recordsApi.list({ serverId: activeServer.id });
      setCloudState(prev => ({ ...prev, records: data }));
    } catch (e) { logger.error('刷新记录列表失败', e); }
  }, [user, activeServer]);

  const refreshPrices = useCallback(async () => {
    if (!user || !activeServer) return;
    try {
      const data = await pricesApi.list(activeServer.id);
      setCloudState(prev => ({ ...prev, prices: data }));
    } catch (e) { logger.error('刷新价格表失败', e); }
  }, [user, activeServer]);

  const refreshGoldHistory = useCallback(async () => {
    if (!user || !activeServer) return;
    try {
      const data = await goldHistoryApi.list(activeServer.id);
      setCloudState(prev => ({ ...prev, goldHistory: data }));
    } catch (e) { logger.error('刷新金价历史失败', e); }
  }, [user, activeServer]);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const serversData = await serversApi.list();
      setCloudState(prev => ({ ...prev, servers: serversData }));
      const sid = activeServerId && serversData.some(s => s.id === activeServerId)
        ? activeServerId : serversData[0]?.id ?? null;
      if (sid) {
        const [recs, prs, gh] = await Promise.all([
          recordsApi.list({ serverId: sid }),
          pricesApi.list(sid),
          goldHistoryApi.list(sid),
        ]);
        setCloudState(prev => ({ ...prev, records: recs, prices: prs, goldHistory: gh }));
        if (!activeServerId || activeServerId !== sid) setActiveServerId(sid);
      }
    } catch (e) {
      logger.error('刷新云端数据失败', e);
    } finally {
      setLoading(false);
    }
  }, [user, activeServerId, setActiveServerId]);

  // Login → sync local to cloud
  useEffect(() => {
    if (!user || synced) return;
    const doSync = async () => {
      setLoading(true);
      try {
        const syncData: FullSyncData = {
          servers: local.data.servers,
          records: local.data.records,
          prices: local.data.prices,
          goldHistory: local.data.goldHistory,
          activeServerId: local.data.activeServerId,
        };
        const resp = await syncApi.fullSync(syncData);
        setCloudState({
          servers: resp.servers, records: resp.records,
          prices: resp.prices, goldHistory: resp.goldHistory,
        });
        if (resp.activeServerId) setActiveServerId(resp.activeServerId);
        setSynced(true);
      } catch (e) {
        logger.error('同步本地数据到云端失败', e);
        try { await refreshAll(); } catch { /* ignore */ }
        setSynced(true);
      } finally {
        setLoading(false);
      }
    };
    void doSync();
  }, [user, synced, local.data, refreshAll, setActiveServerId]);

  // Active server changed → refresh detail data (cloud)
  useEffect(() => {
    if (isCloud && activeServer && synced) {
      void refreshRecords();
      void refreshPrices();
      void refreshGoldHistory();
    }
  }, [activeServer?.id, isCloud, synced]);

  // Logout → reset
  useEffect(() => {
    if (!user) {
      setSynced(false);
      setCloudState({ servers: [], records: [], prices: [], goldHistory: [] });
    }
  }, [user]);

  // --- CRUD (dual mode) ---
  const addServer = useCallback(async (name: string) => {
    if (isCloud) {
      const srv = await serversApi.create({ name });
      await refreshServers();
      setActiveServerId(srv.id);
      return srv;
    } else {
      const srv = local.addServer(name);
      setActiveServerId(srv.id);
      return srv;
    }
  }, [isCloud, local, refreshServers, setActiveServerId]);

  const updateServer = useCallback(async (id: string, patch: Partial<MhServer>) => {
    if (isCloud) { await serversApi.update(id, patch); await refreshServers(); }
    else { local.updateServer(id, patch); }
  }, [isCloud, local, refreshServers]);

  const deleteServer = useCallback(async (id: string) => {
    if (isCloud) { await serversApi.remove(id); await refreshServers(); }
    else { local.deleteServer(id); }
  }, [isCloud, local, refreshServers]);

  const addRecord = useCallback(async (record: Omit<MhRecord, 'id' | 'createdAt'>) => {
    if (isCloud) { await recordsApi.create(record); await refreshRecords(); }
    else { local.addRecord(record); }
  }, [isCloud, local, refreshRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    if (isCloud) { await recordsApi.remove(id); await refreshRecords(); }
    else { local.deleteRecord(id); }
  }, [isCloud, local, refreshRecords]);

  const addPrice = useCallback(async (price: Omit<MhPrice, 'id'>) => {
    if (isCloud) { await pricesApi.create(price); await refreshPrices(); }
    else { local.addPrice(price); }
  }, [isCloud, local, refreshPrices]);

  const updatePrice = useCallback(async (id: string, patch: Partial<MhPrice>) => {
    if (isCloud) { await pricesApi.update(id, patch); await refreshPrices(); }
    else { local.updatePrice(id, patch); }
  }, [isCloud, local, refreshPrices]);

  const deletePrice = useCallback(async (id: string) => {
    if (isCloud) { await pricesApi.remove(id); await refreshPrices(); }
    else { local.deletePrice(id); }
  }, [isCloud, local, refreshPrices]);

  const addGoldHistory = useCallback(async (item: Omit<MhGoldHistory, 'id'>) => {
    if (isCloud) { await goldHistoryApi.create(item); await refreshGoldHistory(); }
    else { local.addGoldHistory(item); }
  }, [isCloud, local, refreshGoldHistory]);

  const deleteGoldHistory = useCallback(async (id: string) => {
    if (isCloud) { await goldHistoryApi.remove(id); await refreshGoldHistory(); }
    else { local.deleteGoldHistory(id); }
  }, [isCloud, local, refreshGoldHistory]);

  // --- Derived stats (computed same way for both modes) ---
  const todayRecords = useMemo(() => {
    const today = todayStr();
    return serverRecords.filter(r => r.recordDate === today);
  }, [serverRecords]);

  const stats = useMemo<StatsSummary>(() => {
    if (!activeServer) return { todayWan: 0, todayYuan: 0, weekWan: 0, weekYuan: 0, monthWan: 0, monthYuan: 0 };
    const today = todayStr();
    const weekStartDate = (() => {
      const d = new Date();
      const day = d.getDay() || 7;
      const t = new Date(d);
      t.setDate(t.getDate() - day + 1);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    })();
    const monthStartDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const { goldBase, goldRate } = activeServer;

    const calcWan = (recs: MhRecord[]) => {
      let sum = 0;
      for (const r of recs) {
        if (r.kind === 'in') sum += r.price;
        else if (r.kind === 'out') sum -= r.price;
        else sum += r.price * r.qty;
      }
      return sum;
    };

    const todayWan = calcWan(serverRecords.filter(r => r.recordDate === today));
    const weekWan = calcWan(serverRecords.filter(r => r.recordDate >= weekStartDate));
    const monthWan = calcWan(serverRecords.filter(r => r.recordDate >= monthStartDate));

    const rate = goldRate / goldBase;
    return {
      todayWan, todayYuan: todayWan * rate,
      weekWan, weekYuan: weekWan * rate,
      monthWan, monthYuan: monthWan * rate,
    };
  }, [serverRecords, activeServer]);

  const sourceDistribution = useMemo<SourceDistributionItem[]>(() => {
    const today = todayStr();
    const todayRecs = serverRecords.filter(r => r.recordDate === today && r.kind !== 'out');
    const map = new Map<string, number>();
    let total = 0;
    for (const r of todayRecs) {
      const amt = r.kind === 'in' ? r.price : r.price * r.qty;
      map.set(r.source, (map.get(r.source) ?? 0) + amt);
      total += amt;
    }
    const arr = Array.from(map.entries()).map(([source, amount]) => ({
      source, amount, percent: total > 0 ? Math.round((amount / total) * 100) : 0,
    }));
    arr.sort((a, b) => b.amount - a.amount);
    return arr;
  }, [serverRecords]);

  const trend = useMemo<TrendPoint[]>(() => {
    const days = 7;
    const result: TrendPoint[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayRecs = serverRecords.filter(r => r.recordDate === dateStr && r.kind !== 'out');
      let amount = 0;
      for (const r of dayRecs) {
        amount += r.kind === 'in' ? r.price : r.price * r.qty;
      }
      result.push({ date: dateStr, amount });
    }
    return result;
  }, [serverRecords]);

  const goldTrend = useMemo<{ date: string; ratePerMillion: number }[]>(() => {
    return serverGoldHistory
      .slice().sort((a, b) => a.recordDate.localeCompare(b.recordDate))
      .slice(-30)
      .map(g => ({ date: g.recordDate, ratePerMillion: g.goldRate }));
  }, [serverGoldHistory]);

  const exportJson = useCallback(() => local.exportJson(), [local]);
  const importJson = useCallback((json: string) => local.importJson(json), [local]);
  const clearAll = useCallback(() => local.clearAll(), [local]);

  return {
    activeServer, servers, serverPrices, serverRecords, serverGoldHistory,
    todayRecords, loading, isCloud,
    stats, sourceDistribution, trend, goldTrend,
    setActiveServer: setActiveServerId,
    addServer, updateServer, deleteServer,
    addRecord, deleteRecord,
    addPrice, updatePrice, deletePrice,
    addGoldHistory, deleteGoldHistory,
    exportJson, importJson, clearAll,
    refreshAll,
  };
}

export type UseLedgerData = ReturnType<typeof useLedgerData>;
