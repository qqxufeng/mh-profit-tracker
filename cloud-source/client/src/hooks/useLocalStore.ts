// ============================================================
// 梦幻搬砖收益账本 · 云版 — 本地存储数据层 client/src/hooks/useLocalStore.ts
// 未登录时所有数据存 localStorage 键 mh_ledger_local_v1：
// { servers / records / prices / goldHistory / activeServerId }
// 首次访问自动初始化默认服务器（绍兴兰亭）和 58 项估价表
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import type { MhServer, MhRecord, MhPrice, MhGoldHistory } from '@shared/api.interface';
import { DEFAULT_PRICES, DEFAULT_GOLD_BASE, DEFAULT_GOLD_RATE, DEFAULT_SERVER_NAME } from '@client/src/utils/constants';
import { genLocalId } from '@client/src/utils/format';

const LS_KEY = 'mh_ledger_local_v1';

interface LocalData {
  servers: MhServer[];
  records: MhRecord[];
  prices: MhPrice[];
  goldHistory: MhGoldHistory[];
  activeServerId: string | null;
}

function getDefaultData(): LocalData {
  const serverId = `srv_${Date.now().toString(36)}`;
  const server: MhServer = {
    id: serverId, name: DEFAULT_SERVER_NAME,
    goldBase: DEFAULT_GOLD_BASE, goldRate: DEFAULT_GOLD_RATE, sortOrder: 0,
  };
  const prices: MhPrice[] = DEFAULT_PRICES.map((p, i) => ({
    id: `pr_${serverId}_${i}`, serverId, name: p.name, category: p.category, price: p.price,
  }));
  return { servers: [server], records: [], prices, goldHistory: [], activeServerId: serverId };
}

function loadLocal(): LocalData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalData;
      if (parsed.servers?.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  const def = getDefaultData();
  saveLocal(def);
  return def;
}

function saveLocal(data: LocalData) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export function useLocalStore() {
  const [data, setData] = useState<LocalData>(() => loadLocal());

  useEffect(() => { saveLocal(data); }, [data]);

  const activeServer = data.servers.find(s => s.id === data.activeServerId) ?? data.servers[0] ?? null;
  const serverPrices = activeServer ? data.prices.filter(p => p.serverId === activeServer.id) : [];
  const serverRecords = activeServer ? data.records.filter(r => r.serverId === activeServer.id) : [];
  const serverGoldHistory = activeServer ? data.goldHistory.filter(g => g.serverId === activeServer.id) : [];

  const setActiveServer = useCallback((id: string) => {
    setData(d => ({ ...d, activeServerId: id }));
  }, []);

  const addServer = useCallback((name: string) => {
    const id = `srv_${Date.now().toString(36)}`;
    const server: MhServer = { id, name, goldBase: DEFAULT_GOLD_BASE, goldRate: DEFAULT_GOLD_RATE, sortOrder: 0 };
    const prices: MhPrice[] = DEFAULT_PRICES.map((p, i) => ({
      id: `pr_${id}_${i}`, serverId: id, name: p.name, category: p.category, price: p.price,
    }));
    setData(d => ({
      ...d, servers: [...d.servers, server], prices: [...d.prices, ...prices], activeServerId: id,
    }));
    return server;
  }, []);

  const updateServer = useCallback((id: string, patch: Partial<MhServer>) => {
    setData(d => ({ ...d, servers: d.servers.map(s => s.id === id ? { ...s, ...patch } : s) }));
  }, []);

  const deleteServer = useCallback((id: string) => {
    setData(d => {
      const remaining = d.servers.filter(s => s.id !== id);
      return {
        ...d,
        servers: remaining,
        records: d.records.filter(r => r.serverId !== id),
        prices: d.prices.filter(p => p.serverId !== id),
        goldHistory: d.goldHistory.filter(g => g.serverId !== id),
        activeServerId: remaining[0]?.id ?? null,
      };
    });
  }, []);

  const addRecord = useCallback((record: Omit<MhRecord, 'id' | 'createdAt'> & { localId?: string }) => {
    const newRec: MhRecord = {
      ...record,
      id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      localId: record.localId ?? genLocalId(),
      createdAt: new Date().toISOString(),
    };
    setData(d => ({ ...d, records: [...d.records, newRec] }));
    return newRec;
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setData(d => ({ ...d, records: d.records.filter(r => r.id !== id) }));
  }, []);

  const addPrice = useCallback((price: Omit<MhPrice, 'id'>) => {
    const newPrice: MhPrice = {
      ...price, id: `pr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    };
    setData(d => ({ ...d, prices: [...d.prices, newPrice] }));
    return newPrice;
  }, []);

  const updatePrice = useCallback((id: string, patch: Partial<MhPrice>) => {
    setData(d => ({ ...d, prices: d.prices.map(p => p.id === id ? { ...p, ...patch } : p) }));
  }, []);

  const deletePrice = useCallback((id: string) => {
    setData(d => ({ ...d, prices: d.prices.filter(p => p.id !== id) }));
  }, []);

  const addGoldHistory = useCallback((item: Omit<MhGoldHistory, 'id'>) => {
    setData(d => {
      const existing = d.goldHistory.findIndex(
        g => g.serverId === item.serverId && g.recordDate === item.recordDate
      );
      if (existing >= 0) {
        const updated = [...d.goldHistory];
        updated[existing] = { ...updated[existing], ...item };
        return { ...d, goldHistory: updated };
      }
      const newItem: MhGoldHistory = {
        ...item, id: `gh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      };
      return { ...d, goldHistory: [...d.goldHistory, newItem] };
    });
  }, []);

  const deleteGoldHistory = useCallback((id: string) => {
    setData(d => ({ ...d, goldHistory: d.goldHistory.filter(g => g.id !== id) }));
  }, []);

  const replaceAll = useCallback((newData: LocalData) => { setData(newData); }, []);
  const exportJson = useCallback(() => JSON.stringify(data, null, 2), [data]);
  const importJson = useCallback((json: string) => {
    const parsed = JSON.parse(json) as LocalData;
    if (!parsed.servers || !Array.isArray(parsed.servers)) throw new Error('数据格式不正确');
    setData(parsed);
  }, []);
  const clearAll = useCallback(() => { setData(getDefaultData()); }, []);

  return {
    data, activeServer, serverPrices, serverRecords, serverGoldHistory,
    setActiveServer, addServer, updateServer, deleteServer,
    addRecord, deleteRecord, addPrice, updatePrice, deletePrice,
    addGoldHistory, deleteGoldHistory, replaceAll, exportJson, importJson, clearAll,
  };
}

export type UseLocalStore = ReturnType<typeof useLocalStore>;
