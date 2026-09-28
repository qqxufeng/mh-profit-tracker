// ============================================================
// 梦幻搬砖收益账本 · 云版 — 登录/注册页 client/src/pages/LoginPage/LoginPage.tsx
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { useAuth } from '@client/src/hooks/useAuth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(username.trim(), password);
        toast.success('登录成功');
      } else {
        await register(username.trim(), password);
        toast.success('注册成功');
      }
      navigate('/');
    } catch (err) {
      logger.error(tab === 'login' ? '登录失败' : '注册失败', err);
      toast.error(tab === 'login' ? '登录失败，请检查账号密码' : '注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="panel-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🪙</div>
          <h1 className="font-serif gold-gradient-text text-3xl font-bold mb-1">
            梦幻搬砖收益账本
          </h1>
          <p className="text-xs text-[#6d6554] tracking-wider">五开收益统计 · 云端同步版</p>
        </div>

        <div className="flex mb-6 border-b border-[rgba(217_178_95_.2)]">
          <button
            type="button"
            className={`flex-1 py-2 text-sm transition-colors ${
              tab === 'login'
                ? 'text-[#d9b25f] border-b-2 border-[#d9b25f] font-semibold'
                : 'text-[#a89e85] hover:text-[#d9b25f]'
            }`}
            onClick={() => setTab('login')}
          >登 录</button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm transition-colors ${
              tab === 'register'
                ? 'text-[#d9b25f] border-b-2 border-[#d9b25f] font-semibold'
                : 'text-[#a89e85] hover:text-[#d9b25f]'
            }`}
            onClick={() => setTab('register')}
          >注 册</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#a89e85] mb-1.5">用户名</label>
            <input type="text" className="dark-input w-full px-3 py-2.5"
              placeholder="请输入用户名" value={username}
              onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-[#a89e85] mb-1.5">密码</label>
            <input type="password" className="dark-input w-full px-3 py-2.5"
              placeholder="请输入密码" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="gold-btn w-full py-3 mt-2 text-base" disabled={submitting}>
            {submitting ? '提交中...' : tab === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button"
            className="text-sm text-[#6d6554] hover:text-[#d9b25f] transition-colors"
            onClick={() => navigate('/')}>
            ← 免登录试用，返回首页
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
