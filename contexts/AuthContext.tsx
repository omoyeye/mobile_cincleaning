import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, pushApi, setToken, clearToken, getToken, ApiError } from '../services/api';
import { stopLiveTracking } from '../services/liveTracking';
import type { UserAccount } from '../types';

/** Last signed-in user, so the app still opens with no signal instead of logging people out. */
const USER_CACHE_KEY = 'cin_user_cache';
/** Set by usePushNotifications; removed from the server on logout so a shared phone stops getting alerts. */
export const PUSH_TOKEN_KEY = 'cin_push_token';

async function cacheUser(user: UserAccount | null) {
  try {
    if (user) await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch {}
}

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
      cacheUser(user);
      setState({ user, loading: false, error: null });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403) {
        // Session expired or account removed: sign out properly.
        await clearToken();
        await cacheUser(null);
        setState({ user: null, loading: false, error: null });
        return;
      }
      // Offline or server busy: keep the session and use the last known profile.
      let cached: UserAccount | null = null;
      try {
        const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
        cached = raw ? (JSON.parse(raw) as UserAccount) : null;
      } catch {}
      setState({ user: cached, loading: false, error: null });
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
      cacheUser(user);
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
        cacheUser(user);
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
    try {
      const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (pushToken) {
        await pushApi.unregisterToken(pushToken).catch(() => {});
        await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      }
    } catch {}
    await stopLiveTracking();
    await authApi.logout();
    await cacheUser(null);
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
