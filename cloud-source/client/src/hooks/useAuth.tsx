// ============================================================
// 梦幻搬砖收益账本 · 云版 — 认证上下文 & hook client/src/hooks/useAuth.tsx
// ============================================================
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { authApi, syncApi } from '@client/src/api';
import type { MhUser } from '@shared/api.interface';

interface AuthContextValue {
  user: MhUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MhUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMe(); }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    setUser(res.user);
    try { await syncApi.pull(); } catch { /* 拉取失败不阻塞登录 */ }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await authApi.register({ username, password });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
