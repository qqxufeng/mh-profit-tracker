// ============================================================
// 梦幻搬砖收益账本 · 云版 — 记账首页 client/src/pages/HomePage/HomePage.tsx
// 顶部品牌 + 三张收益统计卡 → 工具栏（服务器/金价/行情/登录）
// → 主体左右两栏（记账表单+来源分布 / 明细表+图表+折叠面板）
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLedgerData } from '@client/src/hooks/useLedgerData';
import { useAuth } from '@client/src/hooks/useAuth';
import { formatWan } from '@client/src/utils/format';
import ServerManageDialog from './ServerManageDialog';
import GoldPriceDialog from './GoldPriceDialog';
import RecordForm from './RecordForm';
import SourceDistributionCard from './SourceDistributionCard';
import TodayRecordsTable from './TodayRecordsTable';
import { TrendChart, SourcePieChart } from './charts';
import PricePanel from './PricePanel';
import GoldHistoryPanel from './GoldHistoryPanel';
import BackupPanel from './BackupPanel';

const CollapseSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-card overflow-hidden">
      <button type="button"
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[rgba(217_178_95_.03)] transition-colors"
        onClick={() => setOpen(!open)}>
        <span className="font-serif text-base font-bold text-[#efe6cf] flex items-center gap-2">
          <span className="w-1 h-4 bg-[#d9b25f] rounded-sm" />
          {title}
        </span>
        <span className={`text-[#d9b25f] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-[rgba(255_255_255_.05)]">{children}</div>
      )}
    </div>
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ledger = useLedgerData();
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [goldDialogOpen, setGoldDialogOpen] = useState(false);

  const handleServerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    ledger.setActiveServer(e.target.value);
  };

  return (
    <div className="space-y-5">
      {/* Top brand + stats row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🪙</span>
            <h1 className="font-serif gold-gradient-text text-2xl lg:text-3xl font-bold tracking-wider">
              梦幻搬砖收益账本
            </h1>
          </div>
          <p className="text-xs text-[#6d6554] tracking-wider ml-9">
            五开收益统计 · {ledger.isCloud ? '云端同步版' : '本地试用版'}
          </p>
        </div>

        {/* Stat cards */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <div className="panel-card stat-card-today p-3 lg:p-4">
            <div className="text-xs text-[#a89e85] mb-1">今日收益</div>
            <div className="font-serif amt-gold text-xl lg:text-2xl font-bold">
              {formatWan(ledger.stats.todayWan)}
              <span className="text-sm font-normal text-[#a89e85] ml-1">万</span>
            </div>
            <div className="text-xs text-[#6d6554] mt-0.5">≈ {formatWan(ledger.stats.todayYuan)} 元</div>
          </div>
          <div className="panel-card p-3 lg:p-4">
            <div className="text-xs text-[#a89e85] mb-1">本周收益</div>
            <div className="font-serif text-[#efe6cf] text-lg lg:text-xl font-bold">
              {formatWan(ledger.stats.weekWan)}
              <span className="text-sm font-normal text-[#6d6554] ml-1">万</span>
            </div>
            <div className="text-xs text-[#6d6554] mt-0.5">≈ {formatWan(ledger.stats.weekYuan)} 元</div>
          </div>
          <div className="panel-card p-3 lg:p-4">
            <div className="text-xs text-[#a89e85] mb-1">本月收益</div>
            <div className="font-serif text-[#efe6cf] text-lg lg:text-xl font-bold">
              {formatWan(ledger.stats.monthWan)}
              <span className="text-sm font-normal text-[#6d6554] ml-1">万</span>
            </div>
            <div className="text-xs text-[#6d6554] mt-0.5">≈ {formatWan(ledger.stats.monthYuan)} 元</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel-card p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#a89e85]">服务器：</label>
          <select className="dark-input px-3 py-1.5 text-sm appearance-none pr-8 cursor-pointer"
            value={ledger.activeServer?.id ?? ''} onChange={handleServerChange}>
            {ledger.servers.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#141d33]">{s.name}</option>
            ))}
          </select>
          <button type="button" className="mini-btn px-3 py-1.5"
            onClick={() => setServerDialogOpen(true)}>管理服务器</button>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-[#a89e85]">
            当前金价：
            <span className="text-[#d9b25f] font-semibold">
              {ledger.activeServer?.goldBase ?? 0}万 = {ledger.activeServer?.goldRate ?? 0}元
            </span>
          </div>
          <button type="button" className="mini-btn px-3 py-1.5"
            onClick={() => setGoldDialogOpen(true)}>金价设置</button>
          <button type="button" className="mini-btn px-3 py-1.5"
            onClick={() => navigate('/market')}>行情参考</button>
          {!user && (
            <button type="button" className="gold-btn px-4 py-1.5 text-sm"
              onClick={() => navigate('/login')}>登录同步</button>
          )}
        </div>
      </div>

      {/* Main body: left / right */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        <div className="space-y-5">
          <RecordForm ledger={ledger} />
          <SourceDistributionCard ledger={ledger} />
        </div>
        <div className="space-y-5">
          <TodayRecordsTable ledger={ledger} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TrendChart ledger={ledger} />
            <SourcePieChart ledger={ledger} />
          </div>
          <CollapseSection title="物品价格表"><PricePanel ledger={ledger} /></CollapseSection>
          <CollapseSection title="每日金价记录"><GoldHistoryPanel ledger={ledger} /></CollapseSection>
          <CollapseSection title="数据备份"><BackupPanel ledger={ledger} /></CollapseSection>
        </div>
      </div>

      <ServerManageDialog open={serverDialogOpen} onClose={() => setServerDialogOpen(false)} ledger={ledger} />
      <GoldPriceDialog open={goldDialogOpen} onClose={() => setGoldDialogOpen(false)} ledger={ledger} />
    </div>
  );
};

export default HomePage;
