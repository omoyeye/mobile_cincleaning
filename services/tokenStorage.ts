import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cin_auth_token';

// Kept in memory as well, so live tracking can still send updates while the phone is locked
// (the keychain can refuse reads then).
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await SecureStore.getItemAsync(TOKEN_KEY);
    return cached;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
