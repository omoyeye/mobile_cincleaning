import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cin_auth_token';

// SecureStore has no web build, so the browser preview keeps the session in localStorage instead.
const web = Platform.OS === 'web';

// Kept in memory as well, so live tracking can still send updates while the phone is locked
// (the keychain can refuse reads then).
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    cached = web ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : await SecureStore.getItemAsync(TOKEN_KEY);
    return cached;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  if (web) globalThis.localStorage?.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  if (web) globalThis.localStorage?.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
