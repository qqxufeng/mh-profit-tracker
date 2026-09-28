// ============================================================
// 梦幻搬砖收益账本 · 云版 — 记账表单 client/src/pages/HomePage/RecordForm.tsx
// 三种记账类型：物品 / 金币收入 / 金币支出
// 物品类型支持输入时匹配估价表自动回填价格
// ============================================================
import { useState, useMemo } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import type { UseLedgerData } from '@client/src/hooks/useLedgerData';
import { RECORD_SOURCES, GOLD_IN_SOURCES, GOLD_OUT_SOURCES } from '@client/src/utils/constants';
import { formatWan, todayStr } from '@client/src/utils/format';
import type { RecordKind, MhPrice } from '@shared/api.interface';

const RecordForm: React.FC<{ ledger: UseLedgerData }> = ({ ledger }) => {
  const [kind, setKind] = useState<RecordKind>('item');
  const [recordDate, setRecordDate] = useState(todayStr());
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [source, setSource] = useState(RECORD_SOURCES[0]);
  const [note, setNote] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  const sources = useMemo(() => {
    return kind === 'item' ? RECORD_SOURCES : kind === 'in' ? GOLD_IN_SOURCES : GOLD_OUT_SOURCES;
  }, [kind]);

  const currentSource = sources.includes(source) ? source : sources[0];

  const suggestions = useMemo(() => {
    if (!itemName || kind !== 'item') return [];
    const kw = itemName.toLowerCase();
    return ledger.serverPrices.filter((p) => p.name.toLowerCase().includes(kw)).slice(0, 6);
  }, [itemName, kind, ledger.serverPrices]);

  const pickSuggestion = (p: MhPrice) => {
    setItemName(p.name);
    setPrice(String(p.price));
    setShowSuggest(false);
  };

  const handleSubmit = async () => {
    if (!ledger.activeServer) { toast.error('请先选择服务器'); return; }
    const priceNum = Number(price);
    const qtyNum = Number(qty) || 1;
    if (!priceNum || priceNum <= 0) { toast.error('请输入有效单价/金额'); return; }
    if (kind === 'item' && !itemName.trim()) { toast.error('请输入物品名称'); return; }
    try {
      await ledger.addRecord({
        serverId: ledger.activeServer.id,
        recordDate,
        kind,
        itemName: kind === 'item' ? itemName.trim() : kind === 'in' ? '金币收入' : '金币支出',
        price: priceNum,
        qty: kind === 'item' ? qtyNum : 1,
        source: currentSource,
        note: note.trim() || null,
      });
      toast.success('记录已添加');
      setItemName(''); setPrice(''); setQty('1'); setNote('');
    } catch (e) {
      logger.error('添加记录失败', e);
      toast.error('添加失败');
    }
  };

  return (
    <div className="panel-card p-5">
      <h2 className="font-serif text-lg font-bold text-[#efe6cf] mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-[#d9b25f] rounded-sm" />
        记录一笔{kind === 'item' ? '物品' : kind === 'in' ? '金币收入' : '金币支出'}
      </h2>

      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[rgba(255_255_255_.03)] border border-[rgba(255_255_255_.06)]">
        {(['item', 'in', 'out'] as RecordKind[]).map((k) => (
          <button key={k} type="button"
            className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
              kind === k
                ? k === 'out'
                  ? 'bg-[rgba(201_91_74_.2)] text-[#e8897a]'
                  : k === 'in'
                  ? 'bg-[rgba(95_143_122_.2)] text-[#7fb39a]'
                  : 'bg-[rgba(111_157_184_.2)] text-[#8fb8d0]'
                : 'text-[#6d6554] hover:text-[#a89e85]'
            }`}
            onClick={() => setKind(k)}>
            {k === 'item' ? '物品' : k === 'in' ? '金币收入' : '金币支出'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-[#a89e85] mb-1">日期</label>
          <input type="date" className="dark-input w-full px-3 py-2 text-sm"
            value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
        </div>

        {kind === 'item' && (
          <div className="relative">
            <label className="block text-xs text-[#a89e85] mb-1">物品名称</label>
            <input type="text" className="dark-input w-full px-3 py-2 text-sm"
              placeholder="输入物品名自动匹配估价表"
              value={itemName}
              onChange={(e) => { setItemName(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => { setTimeout(() => setShowSuggest(false), 150); }}
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 panel-card py-1 max-h-56 overflow-y-auto">
                {suggestions.map((s) => (
                  <button key={s.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[rgba(217_178_95_.1)] flex justify-between items-center gap-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}>
                    <span className="text-[#efe6cf]">{s.name}</span>
                    <span className="text-[#d9b25f] text-xs">{s.price}万 · {s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#a89e85] mb-1">
              {kind === 'item' ? '单价（万）' : '金额（万）'}
            </label>
            <input type="number" className="dark-input w-full px-3 py-2 text-sm"
              placeholder={kind === 'item' ? '单价' : '金额'}
              value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {kind === 'item' && (
            <div>
              <label className="block text-xs text-[#a89e85] mb-1">数量</label>
              <input type="number" className="dark-input w-full px-3 py-2 text-sm"
                value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-[#a89e85] mb-1">
            {kind === 'out' ? '用途' : '来源'}
          </label>
          <select className="dark-input w-full px-3 py-2 text-sm appearance-none cursor-pointer"
            value={currentSource} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => (
              <option key={s} value={s} className="bg-[#141d33]">{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#a89e85] mb-1">备注</label>
          <input type="text" className="dark-input w-full px-3 py-2 text-sm"
            placeholder="可选" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {kind === 'item' && price && qty && (
          <div className="text-sm text-center py-1.5 rounded-lg bg-[rgba(217_178_95_.06)] border border-[rgba(217_178_95_.15)]">
            合计：<span className="amt-gold font-serif text-base">{formatWan(Number(price) * Number(qty))} 万</span>
          </div>
        )}

        <button type="button" className="gold-btn w-full py-2.5 text-base" onClick={handleSubmit}>
          + 记 录 一 笔
        </button>
      </div>
    </div>
  );
};

export default RecordForm;
