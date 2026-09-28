// ============================================================
// 梦幻搬砖收益账本 · 云版 — 后台管理页面 client/src/pages/AdminPage/AdminPage.tsx
// 数据概览 / 用户管理（VIP、管理员、重置密码、删除）/ 行情管理（增删改查）
// 非管理员访问显示无权限（服务端接口亦有 403 保护）
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Users, TrendingUp, BookOpen, Tag, History, Activity, Search, RefreshCw, Plus, Edit2, Trash2, Shield, Crown, Key } from 'lucide-react';

import { adminApi } from '@client/src/api';
import { useAuth } from '@client/src/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import type {
  AdminOverviewStats,
  AdminUserItem,
  AdminMarketServerItem,
  MarketReference,
} from '@shared/api.interface';
import { PRICE_CATEGORIES } from '@client/src/utils/constants';

type TabKey = 'overview' | 'users' | 'market';

interface MarketItemRow {
  name: string;
  category: string;
  price: number;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Overview
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Users
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Password reset dialog
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<AdminUserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Delete user dialog
  const [delDialogOpen, setDelDialogOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<AdminUserItem | null>(null);
  const [delSubmitting, setDelSubmitting] = useState(false);

  // Market
  const [marketServers, setMarketServers] = useState<AdminMarketServerItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);

  // Market edit dialog
  const [marketDialogOpen, setMarketDialogOpen] = useState(false);
  const [marketEditingId, setMarketEditingId] = useState<string | null>(null);
  const [marketForm, setMarketForm] = useState<{
    serverName: string;
    goldBase: string;
    goldRate: string;
    items: MarketItemRow[];
  }>({
    serverName: '',
    goldBase: '',
    goldRate: '',
    items: [],
  });
  const [marketSubmitting, setMarketSubmitting] = useState(false);

  // Delete market dialog
  const [delMarketOpen, setDelMarketOpen] = useState(false);
  const [delMarketTarget, setDelMarketTarget] = useState<AdminMarketServerItem | null>(null);
  const [delMarketSubmitting, setDelMarketSubmitting] = useState(false);

  // Redirect non-admin / not logged in
  useEffect(() => {
    if (user && !user.isAdmin) {
      toast.error('您没有管理员权限');
      navigate('/');
    }
  }, [user, navigate]);

  const isAdmin = !!user?.isAdmin;

  // Load overview
  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const data = await adminApi.overview();
      setOverview(data);
    } catch (e) {
      logger.error('加载概览数据失败', e);
      toast.error('加载概览数据失败');
    } finally {
      setOverviewLoading(false);
    }
  };

  // Load users
  const loadUsers = async (keyword = search) => {
    setUsersLoading(true);
    try {
      const data = await adminApi.listUsers({ pageSize: 50, search: keyword || undefined });
      setUsers(data.items);
    } catch (e) {
      logger.error('加载用户列表失败', e);
      toast.error('加载用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  };

  // Load market
  const loadMarket = async () => {
    setMarketLoading(true);
    try {
      const data = await adminApi.listMarketServers();
      setMarketServers(data);
    } catch (e) {
      logger.error('加载行情列表失败', e);
      toast.error('加载行情列表失败');
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview' && !overview) {
      void loadOverview();
    }
    if (activeTab === 'users' && users.length === 0 && !usersLoading) {
      void loadUsers();
    }
    if (activeTab === 'market' && marketServers.length === 0 && !marketLoading) {
      void loadMarket();
    }
  }, [activeTab, overview, users.length, usersLoading, marketServers.length, marketLoading]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    void loadUsers(searchInput.trim());
  };

  const handleSetVip = async (u: AdminUserItem, vip: boolean) => {
    try {
      const updated = await adminApi.setUserVip(u.id, vip);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      toast.success(vip ? '已设为 VIP' : '已取消 VIP');
    } catch (e) {
      logger.error('设置 VIP 失败', e);
      toast.error('操作失败');
    }
  };

  const handleSetAdmin = async (u: AdminUserItem, isAdmin: boolean) => {
    try {
      const updated = await adminApi.setUserAdmin(u.id, isAdmin);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? updated : item)));
      toast.success(isAdmin ? '已设为管理员' : '已取消管理员');
    } catch (e) {
      logger.error('设置管理员失败', e);
      toast.error('操作失败');
    }
  };

  const openPwdDialog = (u: AdminUserItem) => {
    setPwdTarget(u);
    setNewPassword('');
    setConfirmPassword('');
    setPwdDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!pwdTarget) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次密码不一致');
      return;
    }
    setPwdSubmitting(true);
    try {
      await adminApi.resetUserPassword(pwdTarget.id, newPassword);
      toast.success('密码已重置');
      setPwdDialogOpen(false);
    } catch (e) {
      logger.error('重置密码失败', e);
      toast.error('重置密码失败');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const openDelDialog = (u: AdminUserItem) => {
    setDelTarget(u);
    setDelDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!delTarget) return;
    setDelSubmitting(true);
    try {
      await adminApi.deleteUser(delTarget.id);
      setUsers((prev) => prev.filter((item) => item.id !== delTarget.id));
      toast.success('已删除用户');
      setDelDialogOpen(false);
    } catch (e) {
      logger.error('删除用户失败', e);
      toast.error('删除失败');
    } finally {
      setDelSubmitting(false);
    }
  };

  // Market CRUD
  const openAddMarket = () => {
    setMarketEditingId(null);
    setMarketForm({
      serverName: '',
      goldBase: String(3000),
      goldRate: String(218),
      items: [],
    });
    setMarketDialogOpen(true);
  };

  const openEditMarket = async (srv: AdminMarketServerItem) => {
    try {
      const detail: MarketReference = await adminApi.getMarketServer(srv.id);
      setMarketEditingId(srv.id);
      setMarketForm({
        serverName: detail.serverName,
        goldBase: String(detail.goldBase),
        goldRate: String(detail.goldRate),
        items: detail.priceData.items.map((it) => ({
          name: it.name,
          category: it.category,
          price: it.price,
        })),
      });
      setMarketDialogOpen(true);
    } catch (e) {
      logger.error('加载行情详情失败', e);
      toast.error('加载详情失败');
    }
  };

  const addItemRow = () => {
    setMarketForm((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', category: PRICE_CATEGORIES[0], price: 0 }],
    }));
  };

  const removeItemRow = (idx: number) => {
    setMarketForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const updateItemRow = (idx: number, field: keyof MarketItemRow, value: string | number) => {
    setMarketForm((prev) => {
      const next = [...prev.items];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, items: next };
    });
  };

  const handleSaveMarket = async () => {
    const { serverName, goldBase, goldRate, items } = marketForm;
    if (!serverName.trim()) {
      toast.error('请输入区服名称');
      return;
    }
    const base = Number(goldBase);
    const rate = Number(goldRate);
    if (!base || base <= 0) {
      toast.error('请输入有效的金价基准');
      return;
    }
    if (!rate || rate <= 0) {
      toast.error('请输入有效的金价利率');
      return;
    }
    const validItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        category: it.category,
        price: Number(it.price) || 0,
      }));

    setMarketSubmitting(true);
    try {
      if (marketEditingId) {
        await adminApi.updateMarketServer(marketEditingId, {
          serverName: serverName.trim(),
          goldBase: base,
          goldRate: rate,
          items: validItems,
        });
        toast.success('已更新');
      } else {
        await adminApi.createMarketServer({
          serverName: serverName.trim(),
          goldBase: base,
          goldRate: rate,
          items: validItems,
        });
        toast.success('已添加');
      }
      setMarketDialogOpen(false);
      void loadMarket();
    } catch (e) {
      logger.error('保存行情失败', e);
      toast.error('保存失败');
    } finally {
      setMarketSubmitting(false);
    }
  };

  const openDelMarket = (srv: AdminMarketServerItem) => {
    setDelMarketTarget(srv);
    setDelMarketOpen(true);
  };

  const handleDeleteMarket = async () => {
    if (!delMarketTarget) return;
    setDelMarketSubmitting(true);
    try {
      await adminApi.deleteMarketServer(delMarketTarget.id);
      setMarketServers((prev) => prev.filter((s) => s.id !== delMarketTarget.id));
      toast.success('已删除');
      setDelMarketOpen(false);
    } catch (e) {
      logger.error('删除行情失败', e);
      toast.error('删除失败');
    } finally {
      setDelMarketSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="panel-card p-16 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-serif text-xl font-bold text-[#efe6cf] mb-2">
            无权限访问
          </h2>
          <p className="text-sm text-[#a89e85] mb-6">
            该页面仅管理员可访问，请使用管理员账号登录
          </p>
          <button
            type="button"
            className="mini-btn px-5 py-2"
            onClick={() => navigate('/login')}
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  const defaultOverview: AdminOverviewStats = {
    totalUsers: 0,
    todayNewUsers: 0,
    totalRecords: 0,
    totalPrices: 0,
    totalGoldHistory: 0,
    activeUsers7d: 0,
  };
  const displayOverview = overview ?? defaultOverview;
  const statCards: { label: string; value: number; icon: React.ReactNode }[] = [
    { label: '总用户数', value: displayOverview.totalUsers, icon: <Users size={20} /> },
    { label: '今日新增', value: displayOverview.todayNewUsers, icon: <TrendingUp size={20} /> },
    { label: '总记账记录', value: displayOverview.totalRecords, icon: <BookOpen size={20} /> },
    { label: '估价表条目', value: displayOverview.totalPrices, icon: <Tag size={20} /> },
    { label: '金价历史数', value: displayOverview.totalGoldHistory, icon: <History size={20} /> },
    { label: '7 日活跃', value: displayOverview.activeUsers7d, icon: <Activity size={20} /> },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '数据概览' },
    { key: 'users', label: '用户管理' },
    { key: 'market', label: '行情管理' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            className="mini-btn px-3 py-1.5"
            onClick={() => navigate('/')}
          >
            ← 返回账本
          </button>
          <h1 className="font-serif gold-gradient-text text-2xl font-bold">
            后台管理
          </h1>
        </div>
        <div className="w-16 h-0.5 bg-gradient-to-r from-[#d9b25f] to-transparent rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[rgba(217_178_95_.15)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-[#d9b25f]'
                : 'text-[#a89e85] hover:text-[#efe6cf]'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d9b25f] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content: Overview */}
      {activeTab === 'overview' && (
        <div>
          {overviewLoading ? (
            <div className="panel-card p-12 text-center text-[#a89e85]">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="panel-card p-5 flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-[rgba(217_178_95_.12)] border border-[rgba(217_178_95_.3)] flex items-center justify-center text-[#d9b25f]">
                    {card.icon}
                  </div>
                  <div>
                    <div className="font-serif text-3xl font-bold text-[#d9b25f] leading-none">
                      {card.value.toLocaleString()}
                    </div>
                    <div className="text-sm text-[#a89e85] mt-1.5">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab content: Users */}
      {activeTab === 'users' && (
        <div className="panel-card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6d6554]" />
                <Input
                  type="text"
                  placeholder="搜索用户名"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  className="w-56 pl-8"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSearch}
                className="text-[#efe6cf]"
              >
                搜索
              </Button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadUsers()}
              className="text-[#efe6cf]"
            >
              <RefreshCw size={14} />
              刷新
            </Button>
          </div>

          {usersLoading ? (
            <div className="p-12 text-center text-[#a89e85]">加载中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mh-tbl">
                <thead>
                  <tr>
                    <th>用户名</th>
                    <th>VIP</th>
                    <th>管理员</th>
                    <th>注册时间</th>
                    <th>最后同步</th>
                    <th>记账数</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-[#6d6554] py-8">
                        暂无用户
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td className="text-[#efe6cf] font-medium">{u.username}</td>
                        <td>
                          {u.isVip ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(217_178_95_.15)] text-[#d9b25f] border border-[rgba(217_178_95_.4)]">
                              <Crown size={10} />
                              VIP
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(255_255_255_.05)] text-[#6d6554] border border-[rgba(255_255_255_.1)]">
                              普通
                            </span>
                          )}
                        </td>
                        <td>
                          {u.isAdmin ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(217_178_95_.15)] text-[#d9b25f] border border-[rgba(217_178_95_.4)]">
                              <Shield size={10} />
                              管理员
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(255_255_255_.05)] text-[#6d6554] border border-[rgba(255_255_255_.1)]">
                              普通用户
                            </span>
                          )}
                        </td>
                        <td className="text-[#a89e85]">{formatDateTime(u.createdAt)}</td>
                        <td className="text-[#a89e85]">{formatDateTime(u.lastSyncAt)}</td>
                        <td className="text-[#d9b25f] font-semibold">{u.recordCount}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              className="mini-btn px-2 py-1 text-xs"
                              onClick={() => handleSetVip(u, !u.isVip)}
                            >
                              {u.isVip ? '取消VIP' : '设VIP'}
                            </button>
                            <button
                              type="button"
                              className="mini-btn px-2 py-1 text-xs"
                              onClick={() => handleSetAdmin(u, !u.isAdmin)}
                            >
                              {u.isAdmin ? '取消管理员' : '设管理员'}
                            </button>
                            <button
                              type="button"
                              className="mini-btn px-2 py-1 text-xs"
                              onClick={() => openPwdDialog(u)}
                            >
                              <Key size={11} className="inline mr-1" />
                              重置密码
                            </button>
                            <button
                              type="button"
                              className="mini-btn-danger px-2 py-1 text-xs"
                              onClick={() => openDelDialog(u)}
                            >
                              <Trash2 size={11} className="inline mr-1" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab content: Market */}
      {activeTab === 'market' && (
        <div className="panel-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-bold text-[#efe6cf]">区服列表</h2>
            <Button
              size="sm"
              onClick={openAddMarket}
              className="bg-gradient-to-b from-[#e3b96a] to-[#c99a43] text-[#241a05] border-none font-bold hover:brightness-105"
            >
              <Plus size={14} />
              添加区服
            </Button>
          </div>

          {marketLoading ? (
            <div className="p-12 text-center text-[#a89e85]">加载中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mh-tbl">
                <thead>
                  <tr>
                    <th>区服名</th>
                    <th>金价基准(万)</th>
                    <th>金价利率(元)</th>
                    <th>物品数</th>
                    <th>更新时间</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {marketServers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-[#6d6554] py-8">
                        暂无区服数据
                      </td>
                    </tr>
                  ) : (
                    marketServers.map((srv) => (
                      <tr key={srv.id}>
                        <td className="text-[#efe6cf] font-medium">{srv.serverName}</td>
                        <td className="text-[#d9b25f] font-semibold">{srv.goldBase}</td>
                        <td className="text-[#d9b25f] font-semibold">{srv.goldRate}</td>
                        <td className="text-[#a89e85]">{srv.itemCount}</td>
                        <td className="text-[#a89e85]">{formatDateTime(srv.updatedAt)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="mini-btn px-2 py-1 text-xs"
                              onClick={() => openEditMarket(srv)}
                            >
                              <Edit2 size={11} className="inline mr-1" />
                              编辑
                            </button>
                            <button
                              type="button"
                              className="mini-btn-danger px-2 py-1 text-xs"
                              onClick={() => openDelMarket(srv)}
                            >
                              <Trash2 size={11} className="inline mr-1" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reset password dialog */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent className="bg-[#141d33] border-[rgba(217_178_95_.3)] text-[#efe6cf]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#efe6cf]">
              重置密码
            </DialogTitle>
            <DialogDescription className="text-[#a89e85]">
              为用户 {pwdTarget?.username} 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[#a89e85] mb-1 block">新密码</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
              />
            </div>
            <div>
              <label className="text-sm text-[#a89e85] mb-1 block">确认密码</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPwdDialogOpen(false)}
              className="text-[#efe6cf]"
            >
              取消
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={pwdSubmitting}
              className="bg-gradient-to-b from-[#e3b96a] to-[#c99a43] text-[#241a05] border-none font-bold hover:brightness-105"
            >
              {pwdSubmitting ? '提交中...' : '确认重置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user dialog */}
      <Dialog open={delDialogOpen} onOpenChange={setDelDialogOpen}>
        <DialogContent className="bg-[#141d33] border-[rgba(201_91_74_.3)] text-[#efe6cf]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#efe6cf]">
              确认删除
            </DialogTitle>
            <DialogDescription className="text-[#a89e85]">
              确定要删除用户 <span className="text-[#c95b4a] font-semibold">{delTarget?.username}</span> 吗？
              此操作不可撤销，用户的所有数据将被清除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDelDialogOpen(false)}
              className="text-[#efe6cf]"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={delSubmitting}
            >
              {delSubmitting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Market edit dialog */}
      <Dialog open={marketDialogOpen} onOpenChange={setMarketDialogOpen}>
        <DialogContent className="bg-[#141d33] border-[rgba(217_178_95_.3)] text-[#efe6cf] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#efe6cf]">
              {marketEditingId ? '编辑区服' : '添加区服'}
            </DialogTitle>
            <DialogDescription className="text-[#a89e85]">
              配置区服金价和估价物品
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-sm text-[#a89e85] mb-1 block">区服名称</label>
                <Input
                  type="text"
                  value={marketForm.serverName}
                  onChange={(e) => setMarketForm((p) => ({ ...p, serverName: e.target.value }))}
                  placeholder="如：绍兴兰亭"
                />
              </div>
              <div>
                <label className="text-sm text-[#a89e85] mb-1 block">金价基准(万)</label>
                <Input
                  type="number"
                  value={marketForm.goldBase}
                  onChange={(e) => setMarketForm((p) => ({ ...p, goldBase: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-[#a89e85] mb-1 block">金价利率(元)</label>
                <Input
                  type="number"
                  value={marketForm.goldRate}
                  onChange={(e) => setMarketForm((p) => ({ ...p, goldRate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-[#a89e85]">物品明细</label>
                <button
                  type="button"
                  className="mini-btn px-2 py-1 text-xs"
                  onClick={addItemRow}
                >
                  <Plus size={11} className="inline mr-1" />
                  添加物品
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {marketForm.items.length === 0 ? (
                  <div className="text-center text-[#6d6554] py-6 text-sm border border-dashed border-[rgba(255_255_255_.1)] rounded-lg">
                    暂无物品，点击上方按钮添加
                  </div>
                ) : (
                  marketForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemRow(idx, 'name', e.target.value)}
                        placeholder="物品名称"
                        className="flex-1"
                      />
                      <select
                        value={item.category}
                        onChange={(e) => updateItemRow(idx, 'category', e.target.value)}
                        className="dark-input px-2 py-1.5 text-sm w-24"
                      >
                        {PRICE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat} className="bg-[#141d33]">
                            {cat}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateItemRow(idx, 'price', Number(e.target.value))}
                        placeholder="价格(万)"
                        className="w-24"
                      />
                      <button
                        type="button"
                        className="mini-btn-danger px-2 py-1.5"
                        onClick={() => removeItemRow(idx)}
                        aria-label="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="secondary"
              onClick={() => setMarketDialogOpen(false)}
              className="text-[#efe6cf]"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveMarket}
              disabled={marketSubmitting}
              className="bg-gradient-to-b from-[#e3b96a] to-[#c99a43] text-[#241a05] border-none font-bold hover:brightness-105"
            >
              {marketSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete market dialog */}
      <Dialog open={delMarketOpen} onOpenChange={setDelMarketOpen}>
        <DialogContent className="bg-[#141d33] border-[rgba(201_91_74_.3)] text-[#efe6cf]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#efe6cf]">
              确认删除
            </DialogTitle>
            <DialogDescription className="text-[#a89e85]">
              确定要删除区服 <span className="text-[#c95b4a] font-semibold">{delMarketTarget?.serverName}</span> 吗？
              该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDelMarketOpen(false)}
              className="text-[#efe6cf]"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMarket}
              disabled={delMarketSubmitting}
            >
              {delMarketSubmitting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
