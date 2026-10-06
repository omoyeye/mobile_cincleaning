import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, clearToken, getToken } from '../services/api';
import type { UserAccount } from '../types';

interface AuthState {
  user: UserAccount | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string; referredBy?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const refreshUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      const user = await authApi.me();
      setState({ user, loading: false, error: null });
    } catch {
      await clearToken();
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { user, token } = await authApi.login(email, password);
      await setToken(token);
      setState({ user, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      }));
      throw err;
    }
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; password: string; phone?: string; referredBy?: string }) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { user, token } = await authApi.register(data);
        await setToken(token);
        setState({ user, loading: false, error: null });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Registration failed',
        }));
        throw err;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({ user: null, loading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
