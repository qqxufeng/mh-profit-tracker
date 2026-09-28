// ============================================================
// 梦幻搬砖收益账本 · 云版 — 行情参考页 client/src/pages/MarketPage/MarketPage.tsx
// 左栏服务器列表 + 右栏物价明细（按类别分组展示）
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { marketApi } from '@client/src/api';
import { useAuth } from '@client/src/hooks/useAuth';
import type { MarketReference, MarketServerListItem } from '@shared/api.interface';
import { PRICE_CATEGORIES } from '@client/src/utils/constants';

const MarketPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [servers, setServers] = useState<MarketServerListItem[]>([]);
  const [selected, setSelected] = useState<MarketReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketApi.listServers();
        setServers(data);
        if (data.length > 0) {
          setDetailLoading(true);
          try {
            const detail = await marketApi.getServer(data[0].id);
            setSelected(detail);
          } catch (e) { logger.error('加载行情详情失败', e); }
          finally { setDetailLoading(false); }
        }
      } catch (e) {
        logger.error('加载行情数据失败', e);
        toast.error('加载行情数据失败');
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  const groupedPrices = (() => {
    if (!selected) return new Map<string, { name: string; price: number }[]>();
    const map = new Map<string, { name: string; price: number }[]>();
    for (const cat of PRICE_CATEGORIES) { map.set(cat, []); }
    for (const item of selected.priceData.items) {
      const arr = map.get(item.category) ?? [];
      arr.push({ name: item.name, price: item.price });
      map.set(item.category, arr);
    }
    return map;
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className="mini-btn px-3 py-1.5" onClick={() => navigate('/')}>
            ← 返回账本
          </button>
          <h1 className="font-serif gold-gradient-text text-2xl font-bold">行情参考</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(217_178_95_.12)] border border-[rgba(217_178_95_.4)] text-[#d9b25f] text-sm font-semibold">
            <span>👑</span> 会员专享 · 全区服物价金价参考
          </span>
          <span className="text-[#a89e85] text-sm">
            {user?.isVip ? '您已是尊贵会员' : '本期免费开放'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="panel-card p-12 text-center text-[#a89e85]">加载中...</div>
      ) : servers.length === 0 ? (
        <div className="panel-card p-12 text-center text-[#a89e85]">暂无行情数据</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          <div className="space-y-3">
            <h2 className="text-sm text-[#a89e85] font-medium px-1">服务器列表</h2>
            {servers.map((srv) => (
              <button key={srv.id} type="button"
                onClick={async () => {
                  setDetailLoading(true);
                  try {
                    const detail = await marketApi.getServer(srv.id);
                    setSelected(detail);
                  } catch (e) { logger.error('加载行情详情失败', e); toast.error('加载行情详情失败'); }
                  finally { setDetailLoading(false); }
                }}
                className={`panel-card w-full p-4 text-left transition-all ${
                  selected?.id === srv.id
                    ? 'border-[#d9b25f] shadow-[0_0_16px_rgba(217_178_95_.15)]'
                    : 'hover:border-[rgba(217_178_95_.4)]'
                }`}>
                <div className="font-serif text-lg font-semibold text-[#efe6cf] mb-2">
                  {srv.serverName}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#a89e85]">金价</span>
                  <span className="text-[#d9b25f] font-semibold">
                    {srv.goldBase}万 = {srv.goldRate}元
                  </span>
                </div>
                <div className="text-xs text-[#6d6554] mt-1">
                  更新于 {srv.updatedAt?.slice(0, 10) ?? '-'}
                </div>
              </button>
            ))}
          </div>

          <div className="panel-card p-5">
            {detailLoading ? (
              <div className="p-12 text-center text-[#a89e85]">加载中...</div>
            ) : selected ? (
              <>
                <div className="flex items-baseline justify-between mb-5 pb-4 border-b border-[rgba(217_178_95_.2)]">
                  <h2 className="font-serif text-xl font-bold text-[#efe6cf]">
                    {selected.serverName} · 物价明细
                  </h2>
                  <span className="text-sm text-[#6d6554]">
                    共 {selected.priceData.items.length} 件物品
                  </span>
                </div>
                <div className="space-y-6">
                  {Array.from(groupedPrices.entries()).map(([cat, items]) =>
                    items.length === 0 ? null : (
                      <div key={cat}>
                        <h3 className="text-sm font-semibold text-[#d9b25f] mb-2 flex items-center gap-2">
                          <span className="w-1 h-4 bg-[#d9b25f] rounded-sm" />
                          {cat}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {items.map((it) => (
                            <div key={it.name}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(255_255_255_.03)] border border-[rgba(255_255_255_.06)]">
                              <span className="text-sm text-[#efe6cf] truncate">{it.name}</span>
                              <span className="text-sm text-[#d9b25f] font-semibold whitespace-nowrap ml-2">
                                {it.price}万
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-[#a89e85]">请选择服务器</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketPage;
