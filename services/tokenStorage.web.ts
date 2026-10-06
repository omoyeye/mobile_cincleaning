const TOKEN_KEY = 'cin_auth_token';

export async function getToken(): Promise<string | null> {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export async function setToken(token: string): Promise<void> {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export async function clearToken(): Promise<void> {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
